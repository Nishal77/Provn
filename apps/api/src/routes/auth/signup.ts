import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createAuthService } from '../../services/auth.service.js'

const bodySchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[0-9]/, 'Must contain number'),
})

export async function signupRoute(app: FastifyInstance) {
  app.post(
    '/signup',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } }, // Strict: 10/min
    },
    async (req, reply) => {
      const parsed = bodySchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid input',
            field: parsed.error.issues[0]?.path[0] as string,
          },
        })
      }

      const authService = createAuthService(app)

      try {
        const { response, rawRefreshToken } = await authService.signup({
          ...parsed.data,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        })

        reply.setCookie('refreshToken', rawRefreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 30 * 24 * 60 * 60, // 30 days
          path: '/auth/refresh',
        })

        return reply.code(201).send({ success: true, data: response })
      } catch (err) {
        const error = err as Error
        if (error.name === 'ConflictError') {
          return reply.code(409).send({
            success: false,
            error: { code: 'EMAIL_ALREADY_EXISTS', message: 'An account with this email already exists.', field: 'email' },
          })
        }
        app.log.error(err)
        return reply.code(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } })
      }
    }
  )
}
