import crypto from 'node:crypto'
import type { PrismaClient } from '@attesta/db'
import type { BlockchainService } from './blockchain.service.js'
import type { IpfsService } from './ipfs.service.js'
import { env } from '../config/env.js'

// ─────────────────────────────────────────────────────────
// Veriff integration
//
// Veriff verifies government-issued identity documents + selfie biometrics.
// No PII is stored on our side — Veriff handles capture and compliance.
//
// Flow:
//   1. POST /kyc/initiate → create Veriff session → return verificationUrl to frontend
//   2. Frontend redirects user to verificationUrl (Veriff-hosted page, no SDK needed)
//   3. Veriff calls our webhook when decision is made
//   4. POST /kyc/webhook → verify HMAC → if approved, anchor DID on Polygon
// ─────────────────────────────────────────────────────────

const VERIFF_API_URL = 'https://stationapi.veriff.com/v1'

interface VeriffSession {
  status: string
  verification: {
    id: string
    url: string
    sessionToken: string
    status: string
  }
}

interface VeriffDecisionWebhook {
  id: string
  action: 'decision' | 'started' | 'submitted'
  vendorData: string  // userId we passed in
  verification?: {
    id: string
    status: 'approved' | 'declined' | 'resubmission_requested' | 'abandoned' | 'expired'
    person?: {
      firstName?: string
      lastName?: string
    }
  }
}

interface KycServiceDeps {
  db: PrismaClient
  blockchain: BlockchainService
  ipfs: IpfsService
  veriffApiKey: string
  veriffPrivateKey: string
  contractAddress: string
}

export function createKycService(deps: KycServiceDeps) {
  const { db, blockchain, ipfs, veriffApiKey, veriffPrivateKey } = deps

  function hmacSignature(payload: string): string {
    return crypto.createHmac('sha256', veriffPrivateKey).update(payload).digest('hex')
  }

  async function createSession(userId: string, firstName: string, lastName: string): Promise<VeriffSession> {
    const body = JSON.stringify({
      verification: {
        callback: `${env.WEB_URL}/verify/complete`,
        person: { firstName, lastName },
        vendorData: userId,
        timestamp: new Date().toISOString(),
      },
    })

    const res = await fetch(`${VERIFF_API_URL}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-CLIENT': veriffApiKey,
        'X-HMAC-SIGNATURE': hmacSignature(body),
      },
      body,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Veriff API error ${res.status}: ${text}`)
    }

    return res.json() as Promise<VeriffSession>
  }

  // ──────────────────────────────────────────────
  // Service methods
  // ──────────────────────────────────────────────

  async function initiateKyc(userId: string): Promise<{ verificationUrl: string; sessionId: string }> {
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true, veriffSessionId: true, facetecVerifiedAt: true },
    })

    // FaceTec liveness must pass first (Sybil/deepfake prevention before document check)
    if (!user.facetecVerifiedAt) {
      throw Object.assign(
        new Error('Liveness check required before document verification'),
        { code: 'LIVENESS_REQUIRED' }
      )
    }

    const [firstName, ...rest] = (user.name ?? 'Unknown User').split(' ')
    const lastName = rest.join(' ') || 'Unknown'

    const session = await createSession(userId, firstName ?? 'Unknown', lastName)
    const sessionId = session.verification.id
    const verificationUrl = session.verification.url

    await db.user.update({
      where: { id: userId },
      data: { veriffSessionId: sessionId, kycStatus: 'PENDING' },
    })

    return { verificationUrl, sessionId }
  }

  function verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const expected = hmacSignature(rawBody)
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(signature, 'hex')
      )
    } catch {
      return false
    }
  }

  async function handleWebhook(rawBody: string, signature: string): Promise<void> {
    if (!verifyWebhookSignature(rawBody, signature)) {
      throw new Error('Invalid webhook signature')
    }

    const payload = JSON.parse(rawBody) as VeriffDecisionWebhook

    // Only process final decisions — ignore started/submitted events
    if (payload.action !== 'decision' || !payload.verification) return

    const { status } = payload.verification
    const userId = payload.vendorData

    if (!userId) {
      throw new Error(`Veriff webhook missing vendorData (userId)`)
    }

    const user = await db.user.findFirst({
      where: { id: userId },
      include: { profile: true },
    })

    if (!user) {
      throw new Error(`No user found for Veriff vendorData ${userId}`)
    }

    if (status !== 'approved') {
      await db.user.update({
        where: { id: user.id },
        data: { kycStatus: status === 'declined' ? 'REJECTED' : 'PENDING' },
      })
      return
    }

    // ── Approved — upgrade to T1 Government ──

    if (!user.polygonAddress) {
      // Wallet not yet created — mark approved but skip on-chain anchor
      await db.user.update({
        where: { id: user.id },
        data: { kycTier: 'T1_GOVERNMENT', kycStatus: 'APPROVED' },
      })
      return
    }

    const did = `did:polygon:${user.polygonAddress}`

    const rawCid = await ipfs.pinProfile({
      did,
      name: user.profile?.headline ?? null,
      headline: user.profile?.headline ?? null,
      bio: user.profile?.bio ?? null,
      location: user.profile?.location ?? null,
      githubUsername: user.profile?.githubUsername ?? null,
      trustScore: 10,
      kycTier: 'T1_GOVERNMENT',
      createdAt: new Date().toISOString(),
    })
    const documentCid = rawCid ?? ''

    let chainTxHash: string | null = null
    try {
      const result = await blockchain.anchorDID({
        did,
        controllerAddress: user.polygonAddress!,
        documentCid,
        tier: 'T1_GOVERNMENT',
      })
      chainTxHash = result.txHash
    } catch (err) {
      console.error('Blockchain anchor failed, will retry:', err)
    }

    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { kycTier: 'T1_GOVERNMENT', kycStatus: 'APPROVED', did },
      }),
      db.profile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          did,
          ipfsCid: documentCid,
          overallTrustScore: 10,
          chainTxHash,
        },
        update: {
          did,
          ipfsCid: documentCid,
          overallTrustScore: 10,
          chainTxHash,
        },
      }),
    ])
  }

  return { initiateKyc, handleWebhook, verifyWebhookSignature }
}

export type KycService = ReturnType<typeof createKycService>
