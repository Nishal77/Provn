import type { FastifyInstance } from 'fastify'
import { createTrialService } from '../../services/trial.service.js'
import { authenticate } from '../../middleware/authenticate.js'

export async function trialRoutes(app: FastifyInstance) {
  const svc = createTrialService({ db: app.db, trialEvalQueue: app.trialEvalQueue })

  // POST /trials — employer creates a trial
  app.post('/trials', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as never as { currentUser: { sub: string } }).currentUser
    const body = req.body as {
      candidateId: string
      domain?: string
      roleTitle: string
      briefMarkdown?: string
      durationMinutes?: number
      compensationCandidateUsd?: number
      compensationEmployerUsd?: number
    }
    if (!body.candidateId || !body.roleTitle) {
      return reply.status(400).send({ error: 'candidateId and roleTitle required' })
    }
    try {
      const trial = await svc.createTrial(user.sub, { ...body, domain: body.domain ?? 'CODE' })
      return reply.status(201).send({ trial })
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // GET /trials — list trials (candidate or employer view)
  app.get('/trials', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as never as { currentUser: { sub: string } }).currentUser
    const query = req.query as { role?: string }
    const role = query.role === 'employer' ? 'employer' : 'candidate'
    const trials = role === 'employer'
      ? await svc.listForEmployer(user.sub)
      : await svc.listForCandidate(user.sub)
    return reply.send({ trials })
  })

  // POST /trials/:id/invite — employer sends invite to candidate
  app.post('/trials/:id/invite', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as never as { currentUser: { sub: string } }).currentUser
    const { id } = req.params as { id: string }
    try {
      const trial = await svc.sendInvite(id, user.sub)
      return reply.send({ trial })
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // POST /trials/:id/sign — candidate signs WPTA
  app.post('/trials/:id/sign', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as never as { currentUser: { sub: string } }).currentUser
    const { id } = req.params as { id: string }
    const { signature } = req.body as { signature: string }
    try {
      const trial = await svc.signWpta(id, user.sub, signature)
      return reply.send({ trial })
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // GET /trials/:id/launch — candidate launches sandbox
  app.get('/trials/:id/launch', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as never as { currentUser: { sub: string } }).currentUser
    const { id } = req.params as { id: string }
    try {
      const trial = await svc.launchSandbox(id, user.sub)
      return reply.send({ sandboxSessionUrl: trial.sandboxSessionUrl, expiresAt: trial.expiresAt })
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // POST /trials/:id/submit — candidate submits work
  app.post('/trials/:id/submit', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as never as { currentUser: { sub: string } }).currentUser
    const { id } = req.params as { id: string }
    const payload = req.body as {
      keystrokeEntropyScore?: number
      pasteEventCount?: number
      antiCheatFlags?: Record<string, unknown>
      recordingS3Key?: string
    }
    try {
      const trial = await svc.submitTrial(id, user.sub, payload)
      return reply.send({ trial })
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // GET /trials/:id/score — get scorecard
  app.get('/trials/:id/score', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as never as { currentUser: { sub: string } }).currentUser
    const { id } = req.params as { id: string }
    try {
      const trial = await svc.getScore(id, user.sub)
      return reply.send({ trial })
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // GET /trials/:id/recording — employer gets time-limited signed URL
  app.get('/trials/:id/recording', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as never as { currentUser: { sub: string } }).currentUser
    const { id } = req.params as { id: string }
    try {
      const result = await svc.getRecordingUrl(id, user.sub)
      return reply.send(result)
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })
}
