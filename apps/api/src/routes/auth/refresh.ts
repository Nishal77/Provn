import type { FastifyInstance } from 'fastify'
import { createAuthService } from '../../services/auth.service.js'

export async function refreshRoute(app: FastifyInstance) {
  // This route path must match the cookie's `path` setting
  app.post('/refresh', async (req, reply) => {
    const rawRefreshToken = req.cookies['refreshToken']
    if (!rawRefreshToken) {
      return reply.code(401).send({
        success: false,
        error: { code: 'NO_REFRESH_TOKEN', message: 'Refresh token not found.' },
      })
    }

    const authService = createAuthService(app)

    try {
      const { response, rawRefreshToken: newRawToken } = await authService.refresh(rawRefreshToken)

      // Rotate cookie with new token
      reply.setCookie('refreshToken', newRawToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60,
        path: '/auth/refresh',
      })

      return reply.send({ success: true, data: response })
    } catch {
      reply.clearCookie('refreshToken', { path: '/auth/refresh' })
      return reply.code(401).send({
        success: false,
        error: { code: 'INVALID_REFRESH_TOKEN', message: 'Session expired. Please log in again.' },
      })
    }
  })
}
