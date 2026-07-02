import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { createEmploymentService } from '../../services/employment.service.js'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const CreateBody = z.object({
  employerId:     z.string().min(1),
  jobTitle:       z.string().min(1).max(120),
  department:     z.string().max(80).optional(),
  startDate:      z.string().regex(DATE_REGEX, 'startDate must be YYYY-MM-DD'),
  endDate:        z.string().regex(DATE_REGEX, 'endDate must be YYYY-MM-DD').optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE']),
})

const ERROR_STATUS: Record<string, number> = {
  EMPLOYER_NOT_FOUND:  404,
  EMPLOYER_NOT_ACTIVE: 422,
  CANDIDATE_NOT_FOUND: 404,
  DUPLICATE_RECORD:    409,
}

export async function employmentCreateRoute(app: FastifyInstance) {
  app.post(
    '/employment',
    {
      preHandler: [authenticate],
      config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
    },
    async (req, reply) => {
      const parsed = CreateBody.safeParse(req.body)
      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          error: { code: 'INVALID_INPUT', details: parsed.error.flatten() },
        })
      }

      const { employerId, jobTitle, department, startDate, endDate, employmentType } = parsed.data
      const svc = createEmploymentService({ db: app.db, anchorQueue: app.anchorQueue })

      try {
        const record = await svc.createRecord(req.currentUser.sub, {
          employerId,
          jobTitle,
          department,
          startDate: new Date(startDate),
          endDate:   endDate ? new Date(endDate) : undefined,
          employmentType,
        })
        return reply.code(201).send({ success: true, data: record })
      } catch (err) {
        const code = err instanceof Error ? err.message : 'INTERNAL_ERROR'
        app.log.error({ err, userId: req.currentUser.sub }, 'Employment record creation failed')
        return reply
          .code(ERROR_STATUS[code] ?? 500)
          .send({ success: false, error: { code } })
      }
    }
  )
}
