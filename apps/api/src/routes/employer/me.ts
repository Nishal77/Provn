import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate.js'
import { createEmployerService } from '../../services/employer.service.js'

export async function employerMeRoute(app: FastifyInstance) {
  app.get(
    '/employers/me',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const userId = req.currentUser.sub
      const svc = createEmployerService({ db: app.db })

      const employer = await svc.getEmployerForUser(userId)
      if (!employer) {
        return reply.code(404).send({
          success: false,
          error: { code: 'NO_EMPLOYER', message: 'No employer account found.' },
        })
      }

      return reply.send({ success: true, data: { employer } })
    }
  )
}
