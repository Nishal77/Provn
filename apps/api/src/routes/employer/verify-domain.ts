import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate.js'
import { createEmployerService } from '../../services/employer.service.js'

export async function employerVerifyDomainRoute(app: FastifyInstance) {
  app.post(
    '/employers/verify-domain',
    {
      preHandler: [authenticate],
      config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
    },
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

      if (employer.status === 'ACTIVE') {
        return reply.send({ success: true, data: { verified: true, alreadyVerified: true } })
      }

      try {
        const result = await svc.verifyDomain(employer.id)
        return reply.send({ success: true, data: result })
      } catch (err) {
        app.log.error({ err, userId }, 'Domain verification failed')
        return reply.code(500).send({ success: false, error: { code: 'INTERNAL', message: 'Verification check failed.' } })
      }
    }
  )
}
