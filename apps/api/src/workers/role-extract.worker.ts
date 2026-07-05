// Role requirement extraction worker.
// Calls Python /extract/requirements → stores extractedRequirements + capabilityVector
// in the Role row. In production, also upserts the vector to Pinecone.

import { Worker } from 'bullmq'
import type { PrismaClient } from '@attesta/db'
import type { Redis as IORedis } from 'ioredis'

const AI_SERVICE = process.env.AI_SERVICE_URL ?? 'http://localhost:8000'

interface WorkerDeps {
  db: PrismaClient
  redis: IORedis
}

export function createRoleExtractWorker({ db, redis }: WorkerDeps) {
  return new Worker(
    'role-extract-queue',
    async (job) => {
      const { roleId } = job.data as { roleId: string }

      const role = await db.role.findUnique({ where: { id: roleId } })
      if (!role) { job.log(`Role ${roleId} not found — skip`); return }

      await db.role.update({ where: { id: roleId }, data: { extractionStatus: 'EXTRACTING' } })

      try {
        const aiRes = await fetch(`${AI_SERVICE}/extract/requirements`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role_id: roleId,
            domain: role.domain,
            github_repo_url: role.githubRepoUrl,
            figma_project_url: role.figmaProjectUrl,
            description_text: role.descriptionText ?? '',
          }),
          signal: AbortSignal.timeout(5 * 60 * 1000),
        })

        if (!aiRes.ok) throw new Error(`AI service ${aiRes.status}: ${await aiRes.text()}`)

        const result = await aiRes.json() as {
          extracted_requirements: Record<string, unknown>
          capability_vector: number[]   // 2048-dim
          pinecone_vector_id?: string
        }

        await db.role.update({
          where: { id: roleId },
          data: {
            extractedRequirements: result.extracted_requirements as never,
            capabilityVector: result.capability_vector as never,
            pineconeVectorId: result.pinecone_vector_id ?? `vec-${roleId}`,
            extractionStatus: 'DONE',
          },
        })
        job.log(`Role ${roleId} requirements extracted. Vector dim: ${result.capability_vector?.length}`)
      } catch (err) {
        await db.role.update({ where: { id: roleId }, data: { extractionStatus: 'FAILED' } })
        throw err
      }
    },
    {
      connection: redis as never,
      concurrency: 3,
      lockDuration: 6 * 60 * 1000,
    },
  )
}
