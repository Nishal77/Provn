// Skill anchor worker — writes AI-scored skill attestations to Polygon.
//
// Steps:
//   1. Load SCORED attestation from DB
//   2. Pin attestation JSON to IPFS (Pinata)
//   3. Call DIDRegistry.updateDID() with new CID + T5_AI_INFERRED tier
//   4. Mark attestation as ANCHORED in DB (atomic with tier upgrade)

import { Worker, type Job } from 'bullmq'
import type { PrismaClient } from '@attesta/db'
import type { Redis } from 'ioredis'
import { createBlockchainService } from '../services/blockchain.service.js'
import { env } from '../config/env.js'

export interface SkillAnchorJobPayload {
  attestationId: string
}

// Tiers lower than T5_AI_INFERRED can be upgraded; T4+ already higher, keep them.
const UPGRADEABLE_TO_T5 = ['T6_SELF'] as const

export function createSkillAnchorWorker(deps: { db: PrismaClient; redis: Redis }) {
  const { db, redis } = deps

  const worker = new Worker<SkillAnchorJobPayload>(
    'skill-anchor-queue',
    async (job: Job<SkillAnchorJobPayload>) => {
      const { attestationId } = job.data

      const attestation = await db.skillAttestation.findUnique({
        where: { id: attestationId },
        include: {
          user: { select: { id: true, did: true, email: true, kycTier: true, name: true } },
        },
      })
      if (!attestation) throw new Error(`Attestation ${attestationId} not found`)
      if (attestation.status === 'ANCHORED' || attestation.status === 'ANCHORING') {
        if (attestation.status === 'ANCHORED') return
      }
      if (attestation.status !== 'SCORED') {
        throw new Error(`Attestation ${attestationId} in status ${attestation.status}, expected SCORED`)
      }

      await db.skillAttestation.update({ where: { id: attestationId }, data: { status: 'ANCHORING' } })

      // ── Pin to IPFS ──────────────────────────────────────────────────────
      const doc = {
        '@context': 'https://attesta.io/schemas/skill/v1',
        type: 'SkillAttestation',
        id: attestation.id,
        userId: attestation.userId,
        skillSlug: attestation.skillSlug,
        skillLevel: attestation.skillLevel,
        aiEvalScore: attestation.aiEvalScore,
        aiEvalReport: attestation.aiEvalReport,
        artifactType: attestation.artifactType,
        createdAt: attestation.createdAt.toISOString(),
      }

      let ipfsCid: string | null = null
      if (env.PINATA_JWT) {
        const pinRes = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.PINATA_JWT}` },
          body: JSON.stringify({
            pinataContent: doc,
            pinataMetadata: { name: `skill-${attestationId}`, keyvalues: { attestationId, userId: attestation.userId } },
          }),
        })
        if (pinRes.ok) {
          const pinData = (await pinRes.json()) as { IpfsHash: string }
          ipfsCid = pinData.IpfsHash
        } else {
          console.warn(`[skill-anchor] Pinata failed for ${attestationId}, continuing without IPFS`)
        }
      }

      // ── Anchor on Polygon ────────────────────────────────────────────────
      const candidateDid = attestation.user.did
      if (!candidateDid) throw new Error(`User ${attestation.userId} has no DID — cannot anchor`)

      const rpcUrl = env.NODE_ENV === 'production'
        ? (env.POLYGON_RPC_URL ?? '')
        : (env.AMOY_RPC_URL ?? env.POLYGON_RPC_URL ?? '')

      const contractAddress = env.NODE_ENV === 'production'
        ? (env.POLYGON_DID_REGISTRY_ADDRESS ?? env.DID_REGISTRY_ADDRESS ?? '')
        : (env.AMOY_DID_REGISTRY_ADDRESS ?? env.DID_REGISTRY_ADDRESS ?? '')

      if (!contractAddress) {
        console.warn(`[skill-anchor] DID_REGISTRY_ADDRESS not configured — skipping on-chain anchor for attestation ${attestationId}`)
        await db.skillAttestation.update({ where: { id: attestationId }, data: { status: 'SCORED' } })
        return
      }

      const chain = createBlockchainService({
        rpcUrl,
        privateKey: (env.DEPLOYER_PRIVATE_KEY ?? '0x0') as `0x${string}`,
        contractAddress: contractAddress as `0x${string}`,
        isMainnet: env.NODE_ENV === 'production',
      })

      const anchorResult = await chain.updateDID({
        did: candidateDid,
        newDocumentCid: ipfsCid ?? doc.id,
        newTier: 'T5_AI_INFERRED',
      })

      await db.$transaction([
        db.skillAttestation.update({
          where: { id: attestationId },
          data: {
            status: 'ANCHORED',
            evidenceCid: ipfsCid ?? null,
            chainTxHash: anchorResult.txHash,
            chainAnchoredAt: new Date(),
          },
        }),
        db.user.updateMany({
          where: { id: attestation.userId, kycTier: { in: UPGRADEABLE_TO_T5 as never } },
          data: { kycTier: 'T5_AI_INFERRED' },
        }),
      ])

      console.log(`[skill-anchor] Attestation ${attestationId} anchored: ${anchorResult.txHash}`)
    },
    { connection: redis as never, concurrency: 5 }
  )

  worker.on('failed', (job, err) => {
    console.error(`[skill-anchor] Job ${job?.id} failed:`, err.message)
  })

  return worker
}
