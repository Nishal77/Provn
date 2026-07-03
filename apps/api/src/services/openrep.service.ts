/**
 * OpenRep Protocol service — public API endpoints.
 * Implements the 6 public endpoints defined in ATTESTA PRD.
 * These are unauthenticated (public protocol) — rate limited at edge.
 *
 * Security: no PII returned. On-chain: only hashes. ZK: client-side only.
 */
import { PrismaClient } from '@prisma/client'
import { createHash, randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

// ────────────────── DID RESOLUTION ──────────────────

export async function resolveDID(did: string) {
  const profile = await db.profile.findFirst({
    where: { user: { did } },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          did: true,
          kycTier: true,
          polygonAddress: true,
        },
      },
    },
  })

  if (!profile) return null

  // W3C DID Document format
  return {
    '@context': ['https://www.w3.org/ns/did/v1'],
    id: did,
    verificationMethod: [
      {
        id: `${did}#primary`,
        type: 'EcdsaSecp256k1RecoveryMethod2020',
        controller: did,
        blockchainAccountId: `eip155:137:${profile.user.polygonAddress}`,
      },
    ],
    service: [
      {
        id: `${did}#attesta`,
        type: 'LinkedDomains',
        serviceEndpoint: `https://attesta.io/proof/${encodeURIComponent(did)}`,
      },
    ],
    created: profile.createdAt.toISOString(),
    updated: profile.updatedAt.toISOString(),
  }
}

// ────────────────── VC METADATA ──────────────────

export async function getVCMetadata(vcId: string) {
  // VCs are either skill attestations or employment records anchored on-chain.
  // No PII returned — only metadata + hashes.

  const skill = await db.skillAttestation.findUnique({
    where: { id: vcId },
    select: {
      id: true,
      skillSlug: true,
      skillLevel: true,
      status: true,
      chainTxHash: true,
      createdAt: true,
      profile: { select: { user: { select: { did: true } } } },
    },
  })
  if (skill) {
    return {
      id: vcId,
      type: 'SkillAttestation',
      subject: skill.profile.user.did,
      claim: { skill: skill.skillSlug, level: skill.skillLevel },
      chainTxHash: skill.chainTxHash,
      issuedAt: skill.createdAt,
    }
  }

  const emp = await db.employmentRecord.findUnique({
    where: { id: vcId },
    select: {
      id: true,
      verificationTier: true,
      chainTxHash: true,
      createdAt: true,
      profile: { select: { user: { select: { did: true } } } },
    },
  })
  if (emp) {
    return {
      id: vcId,
      type: 'EmploymentRecord',
      subject: emp.profile.user.did,
      verificationTier: emp.verificationTier,
      chainTxHash: emp.chainTxHash,
      issuedAt: emp.createdAt,
    }
  }

  return null
}

// ────────────────── VERIFY ──────────────────

export async function verifyVC(vcId: string) {
  const vc = await getVCMetadata(vcId)
  if (!vc) return { verified: false, reason: 'VC not found' }
  if (!vc.chainTxHash) return { verified: false, reason: 'Not yet anchored on-chain' }

  // In production: query Polygon node to verify tx exists + event matches hash.
  // Dev: trust DB record.
  return {
    verified: true,
    vcId,
    chainTxHash: vc.chainTxHash,
    verifiedAt: new Date().toISOString(),
  }
}

// ────────────────── ISSUER LIST ──────────────────

export async function listIssuers(filters?: { countryCode?: string; status?: string }) {
  const issuers = await db.universityIssuer.findMany({
    where: {
      status: (filters?.status as any) ?? 'ACTIVE',
      ...(filters?.countryCode ? { countryCode: filters.countryCode } : {}),
    },
    select: {
      id: true,
      did: true,
      name: true,
      domain: true,
      countryCode: true,
      logoUrl: true,
      websiteUrl: true,
      status: true,
      verifiedAt: true,
      _count: { select: { credentials: true } },
    },
    orderBy: { name: 'asc' },
  })
  return issuers
}

// ────────────────── REGISTER ISSUER ──────────────────

export async function registerIssuer(input: {
  did: string
  name: string
  domain: string
  countryCode: string
  logoUrl?: string
  websiteUrl?: string
}) {
  // Generate raw API key (returned once — never stored plaintext)
  const rawKey = `orep_${randomBytes(32).toString('hex')}`
  const keyHash = await bcrypt.hash(rawKey, 12)

  const issuer = await db.universityIssuer.create({
    data: {
      did: input.did,
      name: input.name,
      domain: input.domain,
      countryCode: input.countryCode,
      logoUrl: input.logoUrl,
      websiteUrl: input.websiteUrl,
      issuerApiKeyHash: keyHash,
      status: 'PENDING',
    },
  })

  return { ...issuer, apiKey: rawKey } // caller must save this; never returned again
}

// ────────────────── ISSUE CREDENTIAL ──────────────────

/**
 * Issuer-authenticated endpoint — called by universities.
 * Accepts API key, issues credential, returns VC metadata (no PII).
 */
export async function issueCredential(input: {
  issuerApiKey: string
  profileDid: string
  credentialType: string
  schemaUrl: string
  evidenceCid?: string
  expiresAt?: string
}) {
  // Find issuer by key hash match
  const issuers = await db.universityIssuer.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, issuerApiKeyHash: true },
  })

  let matchedIssuerId: string | null = null
  for (const issuer of issuers) {
    if (await bcrypt.compare(input.issuerApiKey, issuer.issuerApiKeyHash)) {
      matchedIssuerId = issuer.id
      break
    }
  }

  if (!matchedIssuerId) {
    const err = new Error('Invalid issuer API key') as any
    err.statusCode = 401
    throw err
  }

  const credential = await db.issuedCredential.create({
    data: {
      issuerId: matchedIssuerId,
      profileDid: input.profileDid,
      credentialType: input.credentialType as any,
      schemaUrl: input.schemaUrl,
      evidenceCid: input.evidenceCid,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
    },
  })

  return credential
}

// ────────────────── PUBLIC PROFILE ──────────────────

export async function getPublicProfile(did: string) {
  const profile = await db.profile.findFirst({
    where: { user: { did } },
    select: {
      overallTrustScore: true,
      user: { select: { did: true, kycTier: true } },
      skillAttestations: {
        where: { status: 'ANCHORED' },
        select: { skillSlug: true, skillLevel: true, aiEvalScore: true },
      },
    },
  })
  return profile
}
