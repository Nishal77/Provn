import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate.js'
import { createEmploymentService } from '../../services/employment.service.js'

export async function employmentListRoute(app: FastifyInstance) {
  app.get(
    '/employment',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const svc = createEmploymentService({ db: app.db, anchorQueue: app.anchorQueue })
      const records = await svc.getCandidateRecords(req.currentUser.sub)
      return reply.send({ success: true, data: records })
    }
  )
}
