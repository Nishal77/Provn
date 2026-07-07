import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { createFaceTecService } from '../../services/facetec.service.js'
import { env } from '../../config/env.js'

const bodySchema = z.object({
  sessionId: z.string().min(1),
  faceScan: z.string().min(1),
  auditTrailImage: z.string().min(1),
  lowQualityAuditTrailImage: z.string().min(1),
})

/**
 * POST /kyc/facetec/validate
 *
 * Called by the browser after FaceTec SDK completes a liveness check.
 * The SDK passes the encrypted faceScan data here; we forward it to
 * FaceTec's server for cryptographic validation.
 *
 * On success: stamps user.facetecVerifiedAt — this gates the Veriff
 * document check in POST /kyc/initiate.
 *
 * FaceTec data is never stored — only the pass/fail timestamp.
 */
export async function facetecValidateRoute(app: FastifyInstance) {
  app.post(
    '/kyc/facetec/validate',
    {
      preHandler: [authenticate],
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
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

      const parsed = bodySchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid input',
          },
        })
      }

      const userId = req.currentUser.sub

      const user = await app.db.user.findUnique({
        where: { id: userId },
        select: { kycTier: true },
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
        const result = await facetec.validateLiveness(parsed.data)

        if (!result.success) {
          app.log.warn({ userId, sessionId: result.sessionId, checks: result.checks }, 'FaceTec liveness failed')
          return reply.code(422).send({
            success: false,
            error: {
              code: 'LIVENESS_FAILED',
              message: 'Liveness check did not pass. Please try again in good lighting.',
            },
          })
        }

        // Stamp the verified timestamp — this gates the Veriff doc check
        await app.db.user.update({
          where: { id: userId },
          data: {
            facetecSessionId: result.sessionId,
            facetecVerifiedAt: new Date(),
          },
        })

        app.log.info({ userId, sessionId: result.sessionId }, 'FaceTec 3D liveness passed')

        return reply.send({
          success: true,
          data: { sessionId: result.sessionId },
        })
      } catch (err) {
        app.log.error({ err, userId }, 'FaceTec liveness validation error')
        return reply.code(502).send({
          success: false,
          error: { code: 'FACETEC_ERROR', message: 'Liveness service unavailable. Please try again.' },
        })
      }
    }
  )
}
