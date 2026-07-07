import type { FastifyInstance } from 'fastify'
import { createKycService } from '../../services/kyc.service.js'
import { createBlockchainService } from '../../services/blockchain.service.js'
import { createIpfsService } from '../../services/ipfs.service.js'
import { env } from '../../config/env.js'

/**
 * POST /kyc/webhook
 *
 * Veriff calls this when a decision is made. We verify the HMAC-SHA256
 * signature (X-HMAC-SIGNATURE header) before processing.
 * Raw body required for correct signature verification.
 */
export async function webhookRoute(app: FastifyInstance) {
  app.post(
    '/kyc/webhook',
    {
      config: { rawBody: true },
    },
    async (req, reply) => {
      const signature = req.headers['x-hmac-signature']

      if (!signature || typeof signature !== 'string') {
        return reply.code(401).send({ error: 'Missing X-HMAC-SIGNATURE header' })
      }

      const rawBody = (req as { rawBody?: string }).rawBody

      if (!rawBody) {
        return reply.code(400).send({ error: 'Missing body' })
      }

      if (!env.VERIFF_API_KEY || !env.VERIFF_PRIVATE_KEY) {
        app.log.error('Veriff webhook received but KYC service not configured')
        return reply.code(200).send({ received: true })
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
        veriffApiKey: env.VERIFF_API_KEY,
        veriffPrivateKey: env.VERIFF_PRIVATE_KEY,
        contractAddress: env.DID_REGISTRY_ADDRESS ?? '',
      })

      try {
        await kycService.handleWebhook(rawBody, signature)
        return reply.code(200).send({ received: true })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)

        if (message === 'Invalid webhook signature') {
          app.log.warn({ signature }, 'Rejected Veriff webhook — invalid signature')
          return reply.code(401).send({ error: 'Invalid signature' })
        }

        app.log.error({ err }, 'Veriff webhook processing failed')
        return reply.code(500).send({ error: 'Internal processing error' })
      }
    }
  )
}
