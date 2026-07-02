import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate.js'
import { createEmploymentService } from '../../services/employment.service.js'
import { createEmployerService } from '../../services/employer.service.js'

export async function employmentPendingReviewRoute(app: FastifyInstance) {
  app.get(
    '/employment/pending-review',
    { preHandler: [authenticate] },
    async (req, reply) => {
      // Verify the requesting user is an employer admin
      const employerSvc = createEmployerService({ db: app.db })
      const employer = await employerSvc.getEmployerForUser(req.currentUser.sub)

      if (!employer) {
        return reply.code(404).send({
          success: false,
          error: { code: 'NO_EMPLOYER_ACCOUNT' },
        })
      }

      const svc = createEmploymentService({ db: app.db, anchorQueue: app.anchorQueue })
      const records = await svc.getPendingForEmployer(employer.id)
      return reply.send({ success: true, data: records })
    }
  )
}
