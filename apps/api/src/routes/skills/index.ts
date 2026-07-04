import type { FastifyInstance } from 'fastify'
import { createId } from '@paralleldrive/cuid2'
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

  // POST /skills/:id/peer-request — request peer attestation for a scored skill
  // Candidate sends a co-worker's email; they receive a secure link to co-sign.
  app.post('/skills/:id/peer-request', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { peerEmail, relationship } = req.body as { peerEmail: string; relationship: string }

    if (!peerEmail || !relationship) {
      return reply.code(400).send({ success: false, error: { code: 'FIELDS_REQUIRED' } })
    }

    const attestation = await app.db.skillAttestation.findUnique({
      where: { id },
      select: { id: true, userId: true, skillSlug: true, status: true, skillLevel: true },
    })

    if (!attestation) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND' } })
    if (attestation.userId !== req.currentUser.sub) {
      return reply.code(403).send({ success: false, error: { code: 'FORBIDDEN' } })
    }
    if (!['SCORED', 'ANCHORED'].includes(attestation.status)) {
      return reply.code(409).send({ success: false, error: { code: 'NOT_SCORED_YET' } })
    }

    // Generate secure one-time token for the peer
    const token = createId() + createId()

    await app.db.peerAttestationRequest.create({
      data: {
        attestationId: id,
        peerEmail,
        relationship,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    })

    // TODO: Send email to peerEmail with link: /skills/peer-attest/{token}
    app.log.info({ peerEmail, attestationId: id }, 'Peer attestation request created')

    return reply.code(201).send({ success: true, data: { message: 'Request sent', peerEmail } })
  })

  // POST /skills/peer-attest/:token — peer co-signs a skill (no auth required — token-gated)
  app.post('/skills/peer-attest/:token', async (req, reply) => {
    const { token } = req.params as { token: string }
    const { verdict, comment } = req.body as { verdict: 'CONFIRM' | 'DECLINE'; comment?: string }

    if (!verdict) return reply.code(400).send({ success: false, error: { code: 'VERDICT_REQUIRED' } })

    const request = await app.db.peerAttestationRequest.findUnique({
      where: { token },
      select: {
        id: true,
        attestationId: true,
        peerEmail: true,
        expiresAt: true,
        usedAt: true,
      },
    })

    if (!request) return reply.code(404).send({ success: false, error: { code: 'TOKEN_NOT_FOUND' } })
    if (request.usedAt) return reply.code(409).send({ success: false, error: { code: 'TOKEN_ALREADY_USED' } })
    if (request.expiresAt < new Date()) {
      return reply.code(410).send({ success: false, error: { code: 'TOKEN_EXPIRED' } })
    }

    await app.db.$transaction([
      app.db.peerAttestationRequest.update({
        where: { id: request.id },
        data: { usedAt: new Date(), verdict, comment },
      }),
      ...(verdict === 'CONFIRM'
        ? [
            app.db.skillAttestation.update({
              where: { id: request.attestationId },
              data: { peerCoSigned: true, evidenceType: 'PEER' },
            }),
          ]
        : []),
    ])

    return reply.send({
      success: true,
      data: {
        verdict,
        message: verdict === 'CONFIRM'
          ? 'Thank you — your attestation has been recorded.'
          : 'Response recorded.',
      },
    })
  })
}
