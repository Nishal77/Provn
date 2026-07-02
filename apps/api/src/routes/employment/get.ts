import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate.js'
import { createEmploymentService } from '../../services/employment.service.js'

export async function employmentGetRoute(app: FastifyInstance) {
  app.get(
    '/employment/:id',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const svc = createEmploymentService({ db: app.db, anchorQueue: app.anchorQueue })

      try {
        const record = await svc.getRecordById(id, req.currentUser.sub)
        return reply.send({ success: true, data: record })
      } catch (err) {
        const code = err instanceof Error ? err.message : 'INTERNAL_ERROR'
        const status = code === 'RECORD_NOT_FOUND' ? 404 : code === 'FORBIDDEN' ? 403 : 500
        return reply.code(status).send({ success: false, error: { code } })
      }
    }
  )
}
