import type { FastifyInstance } from 'fastify'
import { createKycService } from '../../services/kyc.service.js'
import { createBlockchainService } from '../../services/blockchain.service.js'
import { createIpfsService } from '../../services/ipfs.service.js'
import { env } from '../../config/env.js'

/**
 * POST /kyc/webhook
 *
 * Onfido calls this when a check completes. We verify the HMAC-SHA256
 * signature before processing — any request without a valid sig is
 * dropped with 401 immediately.
 *
 * This route reads the raw body (not parsed JSON) so the signature
 * check runs against the exact bytes Onfido signed.
 */
export async function webhookRoute(app: FastifyInstance) {
  app.post(
    '/kyc/webhook',
    {
      config: {
        // Skip body parsing — we need raw bytes for signature verification
        rawBody: true,
      },
    },
    async (req, reply) => {
      const signature = req.headers['x-sha2-signature']

      if (!signature || typeof signature !== 'string') {
        return reply.code(401).send({ error: 'Missing signature header' })
      }

      const rawBody = (req as { rawBody?: string }).rawBody

      if (!rawBody) {
        return reply.code(400).send({ error: 'Missing body' })
      }

      if (!env.ONFIDO_API_TOKEN || !env.ONFIDO_WEBHOOK_SECRET) {
        app.log.error('Onfido webhook received but KYC service not configured')
        return reply.code(200).send({ received: true }) // ACK to prevent retries
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
        await kycService.handleWebhook(rawBody, signature)
        return reply.code(200).send({ received: true })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)

        if (message === 'Invalid webhook signature') {
          app.log.warn({ signature }, 'Rejected Onfido webhook — invalid signature')
          return reply.code(401).send({ error: 'Invalid signature' })
        }

        app.log.error({ err }, 'Onfido webhook processing failed')
        return reply.code(500).send({ error: 'Internal processing error' })
      }
    }
  )
}
