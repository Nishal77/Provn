import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate.js'
import { createKycService } from '../../services/kyc.service.js'
import { createBlockchainService } from '../../services/blockchain.service.js'
import { createIpfsService } from '../../services/ipfs.service.js'
import { env } from '../../config/env.js'

export async function initiateRoute(app: FastifyInstance) {
  app.post(
    '/kyc/initiate',
    {
      preHandler: [authenticate],
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const userId = req.currentUser.sub

      const user = await app.db.user.findUnique({
        where: { id: userId },
        select: { kycTier: true, kycStatus: true },
      })

      if (user?.kycTier === 'T1_GOVERNMENT') {
        return reply.code(409).send({
          success: false,
          error: { code: 'ALREADY_VERIFIED', message: 'Already T1 government verified.' },
        })
      }

      if (user?.kycStatus === 'PENDING') {
        return reply.code(409).send({
          success: false,
          error: {
            code: 'VERIFICATION_PENDING',
            message: 'Verification already in progress. Please complete the previous session.',
          },
        })
      }

      if (!env.ONFIDO_API_TOKEN || !env.ONFIDO_WEBHOOK_SECRET) {
        return reply.code(503).send({
          success: false,
          error: { code: 'NOT_CONFIGURED', message: 'KYC service not configured.' },
        })
      }

      const kycService = createKycService({
        db: app.db,
        blockchain: createBlockchainService({
          rpcUrl: env.POLYGON_RPC_URL ?? '',
          privateKey: (env.DEPLOYER_PRIVATE_KEY ?? '0x0') as `0x${string}`,
          contractAddress: (env.DID_REGISTRY_ADDRESS ?? '0x0') as `0x${string}`,
          isMainnet: env.NODE_ENV === 'production',
        }),
        ipfs: createIpfsService({ pinataJwt: env.PINATA_JWT }),
        onfidoApiToken: env.ONFIDO_API_TOKEN,
        webhookSecret: env.ONFIDO_WEBHOOK_SECRET,
        contractAddress: env.DID_REGISTRY_ADDRESS ?? '',
      })

      try {
        const { sdkToken, applicantId } = await kycService.initiateKyc(userId)

        return reply.send({
          success: true,
          data: { sdkToken, applicantId },
        })
      } catch (err) {
        const error = err as Error & { code?: string }

        if (error.code === 'LIVENESS_REQUIRED') {
          return reply.code(403).send({
            success: false,
            error: {
              code: 'LIVENESS_REQUIRED',
              message: 'Complete the 3D liveness check (Step 1) before document verification.',
            },
          })
        }

        app.log.error({ err, userId }, 'KYC initiation failed')
        return reply.code(502).send({
          success: false,
          error: { code: 'ONFIDO_ERROR', message: 'Identity verification service unavailable. Please try again.' },
        })
      }
    }
  )
}
