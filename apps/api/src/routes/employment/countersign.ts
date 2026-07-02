// Public routes — no authentication required.
// The employer proves their identity via the one-time email token alone.
// Rate-limited aggressively to prevent brute-force token enumeration.

import type { FastifyInstance } from 'fastify'
import { createEmploymentService } from '../../services/employment.service.js'

const RATE_LIMIT = { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }

export async function employmentCountersignRoutes(app: FastifyInstance) {
  // GET /employment/countersign/:token — load record preview before signing
  app.get('/employment/countersign/:token', RATE_LIMIT, async (req, reply) => {
    const { token } = req.params as { token: string }
    const svc = createEmploymentService({ db: app.db, anchorQueue: app.anchorQueue })

    try {
      const record = await svc.getRecordByToken(token)
      return reply.send({ success: true, data: record })
    } catch (err) {
      const code = err instanceof Error ? err.message : 'INTERNAL_ERROR'
      const status = code === 'TOKEN_NOT_FOUND' ? 404 : code === 'TOKEN_EXPIRED' ? 410 : 422
      return reply.code(status).send({ success: false, error: { code } })
    }
  })

  // POST /employment/countersign/:token/sign — employer confirms
  app.post('/employment/countersign/:token/sign', RATE_LIMIT, async (req, reply) => {
    const { token } = req.params as { token: string }
    const svc = createEmploymentService({ db: app.db, anchorQueue: app.anchorQueue })

    try {
      const record = await svc.countersign(token)
      return reply.send({ success: true, data: { id: record.id, status: record.status } })
    } catch (err) {
      const code = err instanceof Error ? err.message : 'INTERNAL_ERROR'
      const status = code === 'TOKEN_NOT_FOUND' ? 404 : code === 'TOKEN_EXPIRED' ? 410 : 422
      return reply.code(status).send({ success: false, error: { code } })
    }
  })

  // POST /employment/countersign/:token/reject — employer declines
  app.post('/employment/countersign/:token/reject', RATE_LIMIT, async (req, reply) => {
    const { token } = req.params as { token: string }
    const svc = createEmploymentService({ db: app.db, anchorQueue: app.anchorQueue })

    try {
      await svc.rejectRecord(token)
      return reply.send({ success: true })
    } catch (err) {
      const code = err instanceof Error ? err.message : 'INTERNAL_ERROR'
      return reply.code(code === 'TOKEN_NOT_FOUND' ? 404 : 422).send({ success: false, error: { code } })
    }
  })
}
