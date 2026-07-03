import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate.js'
import { createSkillService } from '../../services/skill.service.js'

export async function skillRoutes(app: FastifyInstance) {
  // POST /skills — submit an artifact for AI evaluation
  app.post('/skills', { preHandler: [authenticate] }, async (req, reply) => {
    const userId = req.currentUser.sub
    const body = req.body as {
      skillSlug: string
      artifactUrl?: string
      artifactType?: 'GITHUB_REPO' | 'GIST' | 'URL' | 'TEXT'
      artifactText?: string
      description?: string
    }

    if (!body.skillSlug?.trim()) {
      return reply.code(400).send({ success: false, error: { code: 'SKILL_SLUG_REQUIRED' } })
    }

    const svc = createSkillService({
      db: app.db,
      skillEvalQueue: app.skillEvalQueue,
      skillAnchorQueue: app.skillAnchorQueue,
    })

    try {
      const result = await svc.submitAttestation(userId, {
        skillSlug: body.skillSlug.toLowerCase().trim(),
        artifactUrl: body.artifactUrl,
        artifactType: body.artifactType ?? 'URL',
        artifactText: body.artifactText,
        description: body.description,
      })
      return reply.code(201).send({ success: true, data: result.attestation })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'UNKNOWN'
      const statusMap: Record<string, number> = {
        ARTIFACT_REQUIRED: 400,
        SKILL_ALREADY_PENDING: 409,
      }
      return reply.code(statusMap[msg] ?? 500).send({ success: false, error: { code: msg } })
    }
  })

  // GET /skills — list caller's skill attestations
  app.get('/skills', { preHandler: [authenticate] }, async (req, reply) => {
    const svc = createSkillService({
      db: app.db,
      skillEvalQueue: app.skillEvalQueue,
      skillAnchorQueue: app.skillAnchorQueue,
    })
    const records = await svc.getAttestations(req.currentUser.sub)
    return reply.send({ success: true, data: records })
  })

  // GET /skills/public/:userId — anchored skills for public profile
  app.get('/skills/public/:userId', async (req, reply) => {
    const { userId } = req.params as { userId: string }
    const svc = createSkillService({
      db: app.db,
      skillEvalQueue: app.skillEvalQueue,
      skillAnchorQueue: app.skillAnchorQueue,
    })
    const records = await svc.getPublicSkills(userId)
    return reply.send({ success: true, data: records })
  })

  // GET /skills/:id — single attestation with eval job status
  app.get('/skills/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const svc = createSkillService({
      db: app.db,
      skillEvalQueue: app.skillEvalQueue,
      skillAnchorQueue: app.skillAnchorQueue,
    })
    try {
      const record = await svc.getAttestationById(id, req.currentUser.sub)
      return reply.send({ success: true, data: record })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'UNKNOWN'
      if (msg === 'NOT_FOUND') return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND' } })
      if (msg === 'FORBIDDEN') return reply.code(403).send({ success: false, error: { code: 'FORBIDDEN' } })
      return reply.code(500).send({ success: false, error: { code: msg } })
    }
  })
}
