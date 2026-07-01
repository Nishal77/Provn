import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { profileService } from '../../services/profile.service.js'

const paramsSchema = z.object({
  did: z.string().min(1),
})

export async function publicProfileRoute(app: FastifyInstance) {
  // GET /profile/proof/:did — public ProofWork profile (no auth required)
  // Accessible at attesta.io/proof/{did}
  app.get(
    '/proof/:did',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const parsed = paramsSchema.safeParse(req.params)
      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          error: { code: 'INVALID_DID', message: 'Invalid DID format.' },
        })
      }

      const decodedDid = decodeURIComponent(parsed.data.did)
      const profile = await profileService.getPublicProfile(decodedDid)

      if (!profile) {
        return reply.code(404).send({
          success: false,
          error: { code: 'PROFILE_NOT_FOUND', message: 'Profile not found or is private.' },
        })
      }

      return reply.send({ success: true, data: profile })
    }
  )
}
