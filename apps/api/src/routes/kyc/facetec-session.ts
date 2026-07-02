import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate.js'
import { createFaceTecService } from '../../services/facetec.service.js'
import { env } from '../../config/env.js'

/**
 * GET /kyc/facetec/session
 *
 * Returns a short-lived FaceTec session token + SDK init params.
 * The browser SDK needs these before it can start a liveness check.
 *
 * Requires: authenticated user, not already T1 verified.
 */
export async function facetecSessionRoute(app: FastifyInstance) {
  app.get(
    '/kyc/facetec/session',
    {
      preHandler: [authenticate],
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      if (
        !env.FACETEC_SERVER_URL ||
        !env.FACETEC_DEVICE_KEY_IDENTIFIER ||
        !env.FACETEC_FACE_SCAN_ENCRYPTION_KEY
      ) {
        return reply.code(503).send({
          success: false,
          error: { code: 'NOT_CONFIGURED', message: 'Liveness service not configured.' },
        })
      }

      const userId = req.currentUser.sub
      const user = await app.db.user.findUnique({
        where: { id: userId },
        select: { kycTier: true, facetecVerifiedAt: true },
      })

      if (user?.kycTier === 'T1_GOVERNMENT') {
        return reply.code(409).send({
          success: false,
          error: { code: 'ALREADY_VERIFIED', message: 'Already T1 government verified.' },
        })
      }

      const facetec = createFaceTecService({
        serverUrl: env.FACETEC_SERVER_URL,
        deviceKeyIdentifier: env.FACETEC_DEVICE_KEY_IDENTIFIER,
        faceScanEncryptionKey: env.FACETEC_FACE_SCAN_ENCRYPTION_KEY,
      })

      try {
        const params = await facetec.getSessionToken()
        return reply.send({ success: true, data: params })
      } catch (err) {
        app.log.error({ err, userId }, 'FaceTec session token request failed')
        return reply.code(502).send({
          success: false,
          error: { code: 'FACETEC_ERROR', message: 'Liveness service unavailable. Please try again.' },
        })
      }
    }
  )
}
