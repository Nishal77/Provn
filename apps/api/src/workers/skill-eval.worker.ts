// Skill eval worker — calls the Python AI service (apps/ai) to score artifacts.
//
// Steps:
//   1. Load the PENDING attestation from DB
//   2. POST to Python /eval/code endpoint (CodeLlama 70B via Bedrock)
//   3. Call skillService.recordEvalResult() — updates DB + enqueues anchor job
//
// SLA: 30-minute timeout (Bedrock inference can be slow for large repos).

import { Worker, type Job } from 'bullmq'
import type { PrismaClient } from '@attesta/db'
import type { Redis } from 'ioredis'
import type { Queue } from 'bullmq'
import { env } from '../config/env.js'
import { createSkillService } from '../services/skill.service.js'

export interface SkillEvalJobPayload {
  attestationId: string
  evalJobId: string
  skillSlug: string
  artifactUrl: string | null
  artifactType: string
  artifactText: string | null
  description: string | null
}

export function createSkillEvalWorker(deps: {
  db: PrismaClient
  redis: Redis
  skillEvalQueue: Queue
  skillAnchorQueue: Queue
}) {
  const { db, redis, skillEvalQueue, skillAnchorQueue } = deps
  const skillService = createSkillService({ db, skillEvalQueue, skillAnchorQueue })
  const aiUrl = env.AI_SERVICE_URL ?? 'http://localhost:5000'

  const worker = new Worker<SkillEvalJobPayload>(
    'skill-eval-queue',
    async (job: Job<SkillEvalJobPayload>) => {
      const { attestationId, evalJobId, skillSlug, artifactUrl, artifactType, artifactText, description } = job.data

      const attestation = await db.skillAttestation.findUnique({ where: { id: attestationId } })
      if (!attestation) throw new Error(`Attestation ${attestationId} not found`)
      if (attestation.status === 'ANCHORED' || attestation.status === 'ANCHORING') return
      if (attestation.status === 'FAILED') return

      // Mark as evaluating
      await db.$transaction([
        db.skillAttestation.update({ where: { id: attestationId }, data: { status: 'EVALUATING' } }),
        db.skillEvalJob.update({
          where: { id: evalJobId },
          data: { status: 'RUNNING', startedAt: new Date(), attempts: { increment: 1 } },
        }),
      ])

      // Call Python AI service
      const aiRes = await fetch(`${aiUrl}/eval/code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attestation_id: attestationId,
          skill_slug: skillSlug,
          artifact_url: artifactUrl,
          artifact_type: artifactType,
          artifact_text: artifactText,
          description,
        }),
        signal: AbortSignal.timeout(29 * 60 * 1000), // 29min — just under BullMQ lock
      })

      if (!aiRes.ok) {
        const errBody = await aiRes.text().catch(() => 'unknown')
        throw new Error(`AI service returned ${aiRes.status}: ${errBody}`)
      }

      const aiResult = (await aiRes.json()) as {
        attestation_id: string
        overall_score: number
        skill_level: number
        categories: {
          code_quality: number
          best_practices: number
          complexity_handling: number
          readability: number
          correctness: number
        }
        reasoning: string
        plagiarism_score: number
        model_used: string
        eval_duration_ms: number
      }

      await skillService.recordEvalResult({
        attestationId: aiResult.attestation_id,
        overallScore: aiResult.overall_score,
        skillLevel: aiResult.skill_level,
        categories: aiResult.categories,
        reasoning: aiResult.reasoning,
        plagiarismScore: aiResult.plagiarism_score,
        modelUsed: aiResult.model_used,
        evalDurationMs: aiResult.eval_duration_ms,
      })
    },
    {
      connection: redis,
      concurrency: 3,
      lockDuration: 30 * 60 * 1000, // 30min lock — Bedrock calls can be slow
    }
  )

  worker.on('failed', async (job, err) => {
    console.error(`[skill-eval] Job ${job?.id} failed:`, err.message)
    if (job?.data.attestationId) {
      await db.skillAttestation.update({
        where: { id: job.data.attestationId },
        data: { status: 'FAILED' },
      }).catch(() => null)
      await db.skillEvalJob.update({
        where: { attestationId: job.data.attestationId },
        data: { status: 'FAILED', lastError: err.message },
      }).catch(() => null)
    }
  })

  worker.on('completed', (job) => {
    console.log(`[skill-eval] Job ${job.id} completed — attestation ${job.data.attestationId} scored`)
  })

  return worker
}
