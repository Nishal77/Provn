import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate.js'

/**
 * GET /kyc/status
 *
 * Returns the current KYC tier and status for the authenticated user.
 * The frontend polls this after the Veriff flow completes to know when
 * the webhook has been processed and the tier has been upgraded.
 */
export async function statusRoute(app: FastifyInstance) {
  app.get(
    '/kyc/status',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const user = await app.db.user.findUniqueOrThrow({
        where: { id: req.currentUser.sub },
        select: {
          kycTier: true,
          kycStatus: true,
          did: true,
          profile: {
            select: {
              overallTrustScore: true,
              chainTxHash: true,
            },
          },
        },
      })

      return reply.send({
        success: true,
        data: {
          tier: user.kycTier,
          status: user.kycStatus,
          did: user.did,
          trustScore: user.profile?.overallTrustScore ?? 0,
          chainTxHash: user.profile?.chainTxHash ?? null,
        },
      })
    }
  )
}
