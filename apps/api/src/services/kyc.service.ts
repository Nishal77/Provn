import crypto from 'node:crypto'
import type { PrismaClient } from '@attesta/db'
import type { BlockchainService } from './blockchain.service.js'
import type { IpfsService } from './ipfs.service.js'
import { env } from '../config/env.js'

// ─────────────────────────────────────────────────────────
// Onfido integration
//
// Onfido verifies government-issued identity documents + selfie biometrics.
// We use ZK mode: Onfido confirms "valid ID, matches selfie" but we never
// store the document images — only the verification result.
//
// Flow:
//   1. POST /kyc/initiate → create Onfido applicant + SDK token → return to frontend
//   2. Frontend runs Onfido Web SDK (captures ID + selfie)
//   3. Onfido calls our webhook when check completes
//   4. POST /kyc/webhook → we parse result → if pass, anchor DID on Polygon
// ─────────────────────────────────────────────────────────

const ONFIDO_API_URL = 'https://api.eu.onfido.com/v3.6'

interface OnfidoApplicant {
  id: string
  created_at: string
  first_name: string
  last_name: string
}

interface OnfidoSdkToken {
  token: string
}

interface OnfidoCheck {
  id: string
  status: 'in_progress' | 'awaiting_applicant' | 'complete' | 'withdrawn'
  result: 'clear' | 'consider' | null
  sub_result: 'clear' | 'rejected' | 'caution' | 'suspected' | null
}

interface OnfidoWebhookPayload {
  payload: {
    action: string
    object: {
      id: string         // check ID
      applicant_id: string
      status: string
      result: string
      sub_result: string
      href: string
    }
  }
}

interface KycServiceDeps {
  db: PrismaClient
  blockchain: BlockchainService
  ipfs: IpfsService
  onfidoApiToken: string
  webhookSecret: string
  contractAddress: string
}

export function createKycService(deps: KycServiceDeps) {
  const { db, blockchain, ipfs, onfidoApiToken, webhookSecret } = deps

  // ──────────────────────────────────────────────
  // Onfido API helpers
  // ──────────────────────────────────────────────

  async function onfidoRequest<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const res = await fetch(`${ONFIDO_API_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Token token=${onfidoApiToken}`,
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Onfido API error ${res.status}: ${body}`)
    }

    return res.json() as Promise<T>
  }

  /**
   * Create an Onfido applicant record. We pass only first/last name —
   * no email, no phone — to minimise PII held by Onfido.
   */
  async function createApplicant(firstName: string, lastName: string): Promise<OnfidoApplicant> {
    return onfidoRequest<OnfidoApplicant>('/applicants', {
      method: 'POST',
      body: JSON.stringify({ first_name: firstName, last_name: lastName }),
    })
  }

  /**
   * Generate a short-lived SDK token for the frontend Onfido Web SDK.
   * The token is scoped to one applicant and expires in 90 minutes.
   */
  async function generateSdkToken(applicantId: string): Promise<string> {
    const data = await onfidoRequest<OnfidoSdkToken>('/sdk_token', {
      method: 'POST',
      body: JSON.stringify({
        applicant_id: applicantId,
        referrer: env.WEB_URL,
      }),
    })
    return data.token
  }

  /**
   * Trigger an Onfido document-only check.
   * Facial similarity is handled by FaceTec 3D (ISO 30107-3) in Step 1 —
   * adding it here would be redundant and delays the check result.
   */
  async function createCheck(applicantId: string): Promise<OnfidoCheck> {
    return onfidoRequest<OnfidoCheck>('/checks', {
      method: 'POST',
      body: JSON.stringify({
        applicant_id: applicantId,
        report_names: ['document'],
        // ZK mode: Onfido destroys the captured media after check completes
        privacy_notices_read_date: new Date().toISOString(),
      }),
    })
  }

  // ──────────────────────────────────────────────
  // Service methods
  // ──────────────────────────────────────────────

  /**
   * Start the Onfido document check for a user.
   * Requires FaceTec 3D liveness to be completed first (facetecVerifiedAt set).
   * Returns the SDK token the frontend needs to initialise the Onfido SDK.
   */
  async function initiateKyc(userId: string): Promise<{ sdkToken: string; applicantId: string }> {
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true, onfidoApplicantId: true, facetecVerifiedAt: true },
    })

    // FaceTec liveness must pass before Onfido document check is allowed.
    // This ensures deepfake/Sybil prevention runs before identity document check.
    if (!user.facetecVerifiedAt) {
      throw Object.assign(
        new Error('Liveness check required before document verification'),
        { code: 'LIVENESS_REQUIRED' }
      )
    }

    // If they already have an applicant, reuse it (idempotent)
    if (user.onfidoApplicantId) {
      const sdkToken = await generateSdkToken(user.onfidoApplicantId)
      return { sdkToken, applicantId: user.onfidoApplicantId }
    }

    const [firstName, ...rest] = (user.name ?? 'Unknown User').split(' ')
    const lastName = rest.join(' ') || 'Unknown'

    const applicant = await createApplicant(firstName ?? 'Unknown', lastName)

    // Trigger the check immediately — frontend will complete capture
    const check = await createCheck(applicant.id)

    await db.user.update({
      where: { id: userId },
      data: {
        onfidoApplicantId: applicant.id,
        onfidoCheckId: check.id,
        kycStatus: 'PENDING',
      },
    })

    const sdkToken = await generateSdkToken(applicant.id)
    return { sdkToken, applicantId: applicant.id }
  }

  /**
   * Verify the Onfido webhook signature.
   * Onfido signs every webhook with HMAC-SHA256 using the webhook secret.
   * We reject any request that doesn't have a valid signature.
   */
  function verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex')

    // Use timingSafeEqual to prevent timing attacks
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(signature, 'hex')
      )
    } catch {
      return false
    }
  }

  /**
   * Handle the Onfido webhook for check completion.
   * If the check passes: upgrade tier to T1, anchor DID on Polygon.
   * If it fails: mark user as rejected.
   */
  async function handleWebhook(rawBody: string, signature: string): Promise<void> {
    if (!verifyWebhookSignature(rawBody, signature)) {
      throw new Error('Invalid webhook signature')
    }

    const payload = JSON.parse(rawBody) as OnfidoWebhookPayload

    if (payload.payload.action !== 'check.completed') {
      // Only process completed checks — ignore other events
      return
    }

    const { applicant_id: applicantId, result, sub_result: subResult } = payload.payload.object

    // Find the user by their Onfido applicant ID
    const user = await db.user.findFirst({
      where: { onfidoApplicantId: applicantId },
      include: { profile: true },
    })

    if (!user) {
      throw new Error(`No user found for Onfido applicant ${applicantId}`)
    }

    // A "clear" result with "clear" sub_result = pass
    const passed = result === 'clear' && subResult === 'clear'

    if (!passed) {
      await db.user.update({
        where: { id: user.id },
        data: { kycStatus: 'REJECTED' },
      })
      return
    }

    // ── KYC passed — upgrade to T1 Government ──

    // 1. Build the DID document (W3C DID Core spec)
    const did = `did:polygon:${user.polygonAddress}`
    void buildDIDDocument(did, user.polygonAddress!) // computed for future pinning; currently using pinProfile for IPFS

    // 2. Pin the DID document to IPFS (as a ProfileSnapshot)
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

    // 3. Anchor the DID on Polygon
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
      // Log but don't fail — the off-chain record is the source of truth until
      // the chain transaction is retried by the blockchain-anchor-queue (Phase 6)
      console.error('Blockchain anchor failed, will retry:', err)
    }

    // 4. Update user record
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: {
          kycTier: 'T1_GOVERNMENT',
          kycStatus: 'APPROVED',
          did,
        },
      }),
      db.profile.update({
        where: { userId: user.id },
        data: {
          did,
          ipfsCid: documentCid,
          overallTrustScore: 10,
          chainTxHash,
          ...(await recomputeCompleteness(user.id)),
        },
      }),
    ])
  }

  /**
   * Construct a minimal W3C DID document.
   * This is what gets stored on IPFS and referenced from the blockchain.
   * No PII — only the DID, the public key reference, and service endpoints.
   */
  function buildDIDDocument(did: string, walletAddress: string): Record<string, unknown> {
    return {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/secp256k1-2019/v1',
      ],
      id: did,
      verificationMethod: [
        {
          id: `${did}#controller`,
          type: 'EcdsaSecp256k1RecoveryMethod2020',
          controller: did,
          blockchainAccountId: `eip155:137:${walletAddress}`,
        },
      ],
      authentication: [`${did}#controller`],
      assertionMethod: [`${did}#controller`],
      service: [
        {
          id: `${did}#attesta-profile`,
          type: 'AttestationService',
          serviceEndpoint: `https://attesta.io/proof/${encodeURIComponent(did)}`,
        },
      ],
    }
  }

  /**
   * Recalculate completeness after tier upgrade so the dashboard reflects it.
   */
  async function recomputeCompleteness(_userId: string) {
    // Simple bump — the full recalculation runs via completeness.service
    // We just signal that govt verification is now done
    return { completenessScore: undefined } // handled by completeness service on next read
  }

  return { initiateKyc, handleWebhook, verifyWebhookSignature }
}

export type KycService = ReturnType<typeof createKycService>
