import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate.js'
import { createEmployerService } from '../../services/employer.service.js'

export async function employerRegisterRoute(app: FastifyInstance) {
  app.post(
    '/employers/register',
    {
      preHandler: [authenticate],
      config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
    },
    async (req, reply) => {
      const userId = req.currentUser.sub

      const body = req.body as {
        name?: string
        domain?: string
        website?: string
        industry?: string
        size?: string
        billingEmail?: string
      }

      if (!body.name?.trim() || !body.domain?.trim() || !body.billingEmail?.trim()) {
        return reply.code(400).send({
          success: false,
          error: { code: 'MISSING_FIELDS', message: 'name, domain, and billingEmail are required.' },
        })
      }

      const svc = createEmployerService({ db: app.db })

      try {
        const result = await svc.registerEmployer({
          adminUserId: userId,
          name: body.name,
          domain: body.domain,
          website: body.website,
          industry: body.industry,
          size: body.size,
          billingEmail: body.billingEmail,
        })

        return reply.code(201).send({ success: true, data: result })
      } catch (err) {
        const e = err as Error & { code?: string }
        if (e.code === 'DOMAIN_TAKEN') {
          return reply.code(409).send({
            success: false,
            error: { code: 'DOMAIN_TAKEN', message: 'This domain is already registered.' },
          })
        }
        app.log.error({ err, userId }, 'Employer registration failed')
        return reply.code(500).send({ success: false, error: { code: 'INTERNAL', message: 'Registration failed.' } })
      }
    }
  )
}
