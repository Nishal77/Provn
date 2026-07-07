// Employment anchor worker — runs after an employer countersigns.
//
// Steps:
//   1. Load the SIGNED record from DB
//   2. Pin the canonical JSON document to IPFS (Pinata)
//   3. Call DIDRegistry.update() on Polygon to record the new CID + T2_EMPLOYER tier
//   4. Mark record as ANCHORED, store tx hash, upgrade candidate's kycTier if eligible
//   5. Send confirmation email to candidate

import { Worker, type Job } from 'bullmq'
import type { PrismaClient } from '@attesta/db'
import type { Redis } from 'ioredis'
import { createBlockchainService } from '../services/blockchain.service.js'
import { sendAnchorConfirmation } from '../services/email.service.js'
import { env } from '../config/env.js'

export interface AnchorJobPayload {
  recordId: string
}

// Tiers that can be upgraded to T2 — T1 (government) is higher and must not be downgraded
const UPGRADEABLE_TO_T2: string[] = ['T6_SELF', 'T5_AI_INFERRED', 'T4_PEER', 'T3_INSTITUTION']

export function createEmploymentAnchorWorker(deps: {
  db: PrismaClient
  redis: Redis
}) {
  const { db, redis } = deps

  const worker = new Worker<AnchorJobPayload>(
    'employment-anchor-queue',
    async (job: Job<AnchorJobPayload>) => {
      const { recordId } = job.data

      const record = await db.employmentRecord.findUnique({
        where: { id: recordId },
        include: {
          candidate: {
            select: {
              id: true,
              did: true,
              email: true,
              kycTier: true,
              name: true,
            },
          },
          employer: { select: { name: true } },
        },
      })

      if (!record) throw new Error(`Employment record ${recordId} not found`)

      // Idempotent — skip if already processed by a previous attempt
      if (record.status === 'ANCHORED' || record.status === 'ANCHORING') {
        if (record.status === 'ANCHORED') return
        // ANCHORING = in progress from a prior attempt; let it continue
      }

      if (record.status !== 'SIGNED') {
        throw new Error(`Record ${recordId} is in status ${record.status}, expected SIGNED`)
      }

      // Mark as ANCHORING so duplicate jobs are no-ops on subsequent retries
      await db.employmentRecord.update({
        where: { id: recordId },
        data: { status: 'ANCHORING' },
      })

      // ── Step 1: Pin canonical document to IPFS ──────────────────────────
      const canonicalDoc = {
        '@context': 'https://attesta.io/schemas/employment/v1',
        type: 'EmploymentAttestation',
        id: record.id,
        documentHash: record.documentHash,
        candidateId: record.candidateId,
        employerId: record.employerId,
        jobTitle: record.jobTitle,
        department: record.department ?? null,
        startDate: record.startDate.toISOString().split('T')[0],
        endDate: record.endDate ? record.endDate.toISOString().split('T')[0] : null,
        employmentType: record.employmentType,
        candidateSignedAt: record.candidateSignedAt?.toISOString() ?? null,
        employerSignedAt: record.employerSignedAt?.toISOString() ?? null,
      }

      // Reuse the Pinata integration from ipfsService — pin as JSON
      let ipfsCid: string | null = null
      const pinatJwt = env.PINATA_JWT
      if (pinatJwt) {
        const pinRes = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${pinatJwt}`,
          },
          body: JSON.stringify({
            pinataContent: canonicalDoc,
            pinataMetadata: {
              name: `employment-${record.id}`,
              keyvalues: { recordId: record.id, candidateId: record.candidateId },
            },
          }),
        })
        if (pinRes.ok) {
          const pinData = (await pinRes.json()) as { IpfsHash: string }
          ipfsCid = pinData.IpfsHash
        } else {
          console.warn(`[anchor-worker] Pinata failed for record ${recordId}, continuing without IPFS`)
        }
      }

      // ── Step 2: Anchor on Polygon via DIDRegistry ───────────────────────
      const candidateDid = record.candidate.did
      if (!candidateDid) {
        // Candidate hasn't completed KYC — leave SIGNED, re-anchor when DID is assigned
        console.warn(`[anchor-worker] Candidate ${record.candidateId} has no DID — skipping anchor, record stays SIGNED`)
        await db.employmentRecord.update({ where: { id: recordId }, data: { status: 'SIGNED' } })
        return
      }

      const rpcUrl = env.NODE_ENV === 'production'
        ? (env.POLYGON_RPC_URL ?? '')
        : (env.AMOY_RPC_URL ?? env.POLYGON_RPC_URL ?? '')

      const contractAddress = env.NODE_ENV === 'production'
        ? (env.POLYGON_DID_REGISTRY_ADDRESS ?? env.DID_REGISTRY_ADDRESS ?? '')
        : (env.AMOY_DID_REGISTRY_ADDRESS ?? env.DID_REGISTRY_ADDRESS ?? '')

      if (!contractAddress) {
        console.warn(`[anchor-worker] DID_REGISTRY_ADDRESS not configured — skipping on-chain anchor for record ${recordId}`)
        await db.employmentRecord.update({ where: { id: recordId }, data: { status: 'SIGNED' } })
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
        newDocumentCid: ipfsCid ?? canonicalDoc.documentHash ?? record.id,
        newTier: 'T2_EMPLOYER',
      })

      const txHash = anchorResult.txHash

      // ── Step 3: Update DB atomically ────────────────────────────────────
      await db.$transaction([
        db.employmentRecord.update({
          where: { id: recordId },
          data: {
            status: 'ANCHORED',
            ipfsCid: ipfsCid ?? null,
            chainTxHash: txHash,
            chainAnchoredAt: new Date(),
          },
        }),
        // Upgrade candidate to T2 only if they don't already hold a higher tier (T1)
        db.user.updateMany({
          where: {
            id: record.candidateId,
            kycTier: { in: UPGRADEABLE_TO_T2 as never },
          },
          data: { kycTier: 'T2_EMPLOYER' },
        }),
      ])

      // ── Step 4: Confirmation email to candidate ──────────────────────────
      const candidateEmail = record.candidate.email
      if (candidateEmail) {
        const isMainnet = env.NODE_ENV === 'production'
        const polygonscanUrl = isMainnet
          ? `https://polygonscan.com/tx/${txHash}`
          : `https://amoy.polygonscan.com/tx/${txHash}`

        await sendAnchorConfirmation({
          toEmail: candidateEmail,
          candidateName: record.candidate.name ?? 'there',
          jobTitle: record.jobTitle,
          employerName: record.employer.name,
          chainTxHash: txHash,
          polygonscanUrl,
        })
      }
    },
    {
      connection: redis as never,
      concurrency: 5,
    }
  )

  worker.on('failed', (job, err) => {
    console.error(`[employment-anchor] Job ${job?.id} failed after retries:`, err.message)
  })

  worker.on('completed', (job) => {
    console.log(`[employment-anchor] Job ${job.id} completed — record ${job.data.recordId} anchored`)
  })

  return worker
}
