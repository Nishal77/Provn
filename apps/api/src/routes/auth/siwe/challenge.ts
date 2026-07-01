import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createAuthService } from '../../../services/auth.service.js'

const bodySchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
})

export async function challengeRoute(app: FastifyInstance) {
  // POST /auth/wallet/challenge
  // Client sends wallet address → server returns a nonce to sign
  app.post('/challenge', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const parsed = bodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Valid Ethereum address required.' },
      })
    }

    const authService = createAuthService(app)
    const challenge = await authService.createSiweChallenge(parsed.data.address)
    return reply.send({ success: true, data: challenge })
  })
}
