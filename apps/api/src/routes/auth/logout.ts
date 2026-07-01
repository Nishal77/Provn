import type { FastifyInstance } from 'fastify'
import { createAuthService } from '../../services/auth.service.js'
import { authenticate } from '../../middleware/authenticate.js'

export async function logoutRoute(app: FastifyInstance) {
  app.post(
    '/logout',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const rawRefreshToken = req.cookies['refreshToken']
      if (rawRefreshToken) {
        const authService = createAuthService(app)
        await authService.logout(rawRefreshToken)
      }

      reply.clearCookie('refreshToken', { path: '/auth/refresh' })
      return reply.send({ success: true, data: null })
    }
  )
}
