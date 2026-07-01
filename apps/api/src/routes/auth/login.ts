import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createAuthService } from '../../services/auth.service.js'

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function loginRoute(app: FastifyInstance) {
  app.post(
    '/login',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const parsed = bodySchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Email and password required.' },
        })
      }

      const authService = createAuthService(app)

      try {
        const { response, rawRefreshToken } = await authService.login({
          ...parsed.data,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        })

        reply.setCookie('refreshToken', rawRefreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 30 * 24 * 60 * 60,
          path: '/auth/refresh',
        })

        return reply.send({ success: true, data: response })
      } catch (err) {
        const error = err as Error
        if (error.name === 'UnauthorizedError') {
          return reply.code(401).send({
            success: false,
            error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
          })
        }
        app.log.error(err)
        return reply.code(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } })
      }
    }
  )
}
