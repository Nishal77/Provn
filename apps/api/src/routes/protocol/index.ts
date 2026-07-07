// OpenRep Protocol API v1 — public, unauthenticated endpoints.
//
// These form the open standard layer (like HTTP for professional trust).
// Any third party can integrate without an ATTESTA account.
//
// Endpoints:
//   GET  /protocol/did/:did          — resolve DID document
//   GET  /protocol/vc/:id            — retrieve VC metadata (no PII)
//   POST /protocol/verify            — verify a VC or ZK proof
//   GET  /protocol/issuers           — list registered issuers
//   POST /protocol/issuers           — register issuer (ATTESTA admin only)
//   POST /protocol/issue             — issue credential (issuer API key auth)
//   GET  /protocol/profile/:did      — public ProofWork profile summary
//   GET  /protocol/linkedin/:username — lookup by LinkedIn username (extension)

import type { FastifyInstance } from 'fastify'
import { createPublicClient, http, parseAbi } from 'viem'
import { polygon, polygonAmoy } from 'viem/chains'
import { env } from '../../config/env.js'
import { authenticate } from '../../middleware/authenticate.js'
import {
  registerIssuer,
  issueCredential,
} from '../../services/openrep.service.js'

export async function protocolRoutes(app: FastifyInstance) {
  // ── GET /protocol/did/:did ───────────────────────────────────────────────
  app.get('/protocol/did/:did', async (req, reply) => {
    const { did } = req.params as { did: string }
    if (!did.startsWith('did:')) {
      return reply.code(400).send({ error: 'Invalid DID format' })
    }

    // Resolve from DB
    const user = await app.db.user.findFirst({
      where: { did },
      select: {
        did: true,
        polygonAddress: true,
        kycTier: true,
        createdAt: true,
        profile: { select: { isPublic: true, overallTrustScore: true, ipfsCid: true } },
      },
    })

    if (!user || !user.profile?.isPublic) {
      return reply.code(404).send({ error: 'DID not found or profile is private' })
    }

    const didDocument = {
      '@context': ['https://www.w3.org/ns/did/v1', 'https://attesta.io/schemas/did/v1'],
      id: did,
      verificationMethod: [
        {
          id: `${did}#key-1`,
          type: 'EcdsaSecp256k1VerificationKey2019',
          controller: did,
          blockchainAccountId: `eip155:137:${user.polygonAddress}`,
        },
      ],
      service: [
        {
          id: `${did}#proofwork`,
          type: 'ProofWorkProfile',
          serviceEndpoint: `https://attesta.io/proof/${did}`,
        },
      ],
      created: user.createdAt.toISOString(),
      attestaMetadata: {
        kycTier: user.kycTier,
        trustScore: Number(user.profile.overallTrustScore ?? 0),
        ipfsCid: user.profile.ipfsCid ?? null,
      },
    }

    return reply
      .header('Content-Type', 'application/did+ld+json')
      .header('Cache-Control', 'public, max-age=300')
      .send(didDocument)
  })

  // ── GET /protocol/vc/:id ─────────────────────────────────────────────────
  // Returns VC metadata — never PII. Only hashes and on-chain refs.
  app.get('/protocol/vc/:id', async (req, reply) => {
    const { id } = req.params as { id: string }

    // Check employment records first, then skill attestations
    const employment = await app.db.employmentRecord.findUnique({
      where: { id },
      select: {
        id: true, status: true, chainTxHash: true, chainAnchoredAt: true,
        documentHash: true, employmentType: true,
        candidate: { select: { did: true } },
        employer: { select: { name: true, domain: true } },
      },
    })

    if (employment && employment.status === 'ANCHORED') {
      return reply.header('Cache-Control', 'public, max-age=600').send({
        id: employment.id,
        type: 'EmploymentAttestation',
        issuer: `did:attesta:employer:${employment.employer.domain}`,
        subject: employment.candidate.did,
        status: employment.status,
        chainTxHash: employment.chainTxHash,
        anchoredAt: employment.chainAnchoredAt,
        documentHash: employment.documentHash,
      })
    }

    const skill = await app.db.skillAttestation.findUnique({
      where: { id },
      select: {
        id: true, status: true, chainTxHash: true, chainAnchoredAt: true,
        skillSlug: true, skillLevel: true, aiEvalScore: true,
        user: { select: { did: true } },
      },
    })

    if (skill && skill.status === 'ANCHORED') {
      return reply.header('Cache-Control', 'public, max-age=600').send({
        id: skill.id,
        type: 'SkillAttestation',
        issuer: 'did:attesta:ai-evaluator',
        subject: skill.user.did,
        status: skill.status,
        chainTxHash: skill.chainTxHash,
        anchoredAt: skill.chainAnchoredAt,
        skillSlug: skill.skillSlug,
        skillLevel: skill.skillLevel,
        aiEvalScore: skill.aiEvalScore,
      })
    }

    return reply.code(404).send({ error: 'VC not found or not yet anchored' })
  })

  // ── POST /protocol/verify ────────────────────────────────────────────────
  // Verify a VC by ID (on-chain check) or a ZK proof bundle.
  app.post('/protocol/verify', async (req, reply) => {
    const body = req.body as {
      type: 'vc' | 'zk'
      vcId?: string
      proof?: { pi_a: string[]; pi_b: string[][]; pi_c: string[] }
      publicSignals?: string[]
      claimType?: 'SALARY_RANGE' | 'EMPLOYMENT_DURATION'
    }

    if (body.type === 'vc' && body.vcId) {
      // Check DB for anchored status
      const emp = await app.db.employmentRecord.findUnique({
        where: { id: body.vcId },
        select: { status: true, chainTxHash: true },
      })
      if (emp) {
        return reply.send({ valid: emp.status === 'ANCHORED', chainTxHash: emp.chainTxHash })
      }
      const skill = await app.db.skillAttestation.findUnique({
        where: { id: body.vcId },
        select: { status: true, chainTxHash: true },
      })
      if (skill) {
        return reply.send({ valid: skill.status === 'ANCHORED', chainTxHash: skill.chainTxHash })
      }
      return reply.code(404).send({ valid: false, error: 'VC not found' })
    }

    if (body.type === 'zk' && body.proof && body.publicSignals && body.claimType) {
      const verifierAddress = body.claimType === 'SALARY_RANGE'
        ? (env.SALARY_RANGE_VERIFIER_ADDRESS ?? '')
        : (env.EMPLOYMENT_VERIFIER_ADDRESS ?? '')

      if (!verifierAddress) {
        return reply.send({ valid: true, note: 'Verifier contract not deployed — dev mode' })
      }

      try {
        const chain = env.NODE_ENV === 'production' ? polygon : polygonAmoy
        const rpcUrl = env.NODE_ENV === 'production'
          ? (env.POLYGON_RPC_URL ?? 'https://polygon-rpc.com')
          : (env.AMOY_RPC_URL ?? 'https://rpc-amoy.polygon.technology')

        const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })
        const abi = parseAbi([
          'function verifyProof(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[] input) view returns (bool)',
        ])
        const { pi_a, pi_b, pi_c } = body.proof!
        const signals = body.publicSignals!.map(s => BigInt(s))

        const valid = await publicClient.readContract({
          address: verifierAddress as `0x${string}`,
          abi,
          functionName: 'verifyProof',
          args: [
            [BigInt(pi_a[0]!), BigInt(pi_a[1]!)],
            [[BigInt(pi_b[0]![0]!), BigInt(pi_b[0]![1]!)], [BigInt(pi_b[1]![0]!), BigInt(pi_b[1]![1]!)]],
            [BigInt(pi_c[0]!), BigInt(pi_c[1]!)],
            signals,
          ],
        })
        return reply.send({ valid: Boolean(valid) })
      } catch (err) {
        return reply.code(500).send({ valid: false, error: 'On-chain ZK verification failed', details: String(err) })
      }
    }

    return reply.code(400).send({ error: 'Invalid verify request' })
  })

  // ── GET /protocol/issuers ────────────────────────────────────────────────
  app.get('/protocol/issuers', async (_req, reply) => {
    const employers = await app.db.employer.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, domain: true, logoUrl: true, industry: true },
      orderBy: { name: 'asc' },
      take: 100,
    })

    const issuers = [
      {
        id: 'did:attesta:ai-evaluator',
        name: 'ATTESTA AI Evaluator',
        type: 'AI',
        description: 'CodeLlama 70B — evaluates code and skill artifacts',
      },
      ...employers.map((e: { domain: string; name: string; logoUrl?: string | null; industry?: string | null }) => ({
        id: `did:attesta:employer:${e.domain}`,
        name: e.name,
        type: 'Employer',
        domain: e.domain,
        logoUrl: e.logoUrl,
        industry: e.industry,
      })),
    ]

    return reply
      .header('Cache-Control', 'public, max-age=3600')
      .send({ issuers, total: issuers.length })
  })

  // ── GET /protocol/profile/:did ───────────────────────────────────────────
  app.get('/protocol/profile/:did', async (req, reply) => {
    const { did } = req.params as { did: string }

    const user = await app.db.user.findFirst({
      where: { did },
      select: {
        did: true,
        name: true,
        imageUrl: true,
        kycTier: true,
        profile: {
          select: {
            headline: true,
            overallTrustScore: true,
            completenessScore: true,
            isPublic: true,
            linkedinUrl: true,
          },
        },
        skillAttestations: {
          where: { status: 'ANCHORED' },
          select: { skillSlug: true, skillLevel: true, chainTxHash: true },
          orderBy: { skillLevel: 'desc' },
          take: 10,
        },
        employmentRecords: {
          where: { status: 'ANCHORED' },
          select: { jobTitle: true, employmentType: true, chainTxHash: true,
                    employer: { select: { name: true, domain: true } } },
          take: 5,
        },
      },
    })

    if (!user || !user.profile?.isPublic) {
      return reply.code(404).send({ error: 'Profile not found or private' })
    }

    return reply.header('Cache-Control', 'public, max-age=60').send({
      did: user.did,
      kycTier: user.kycTier,
      fullName: user.name,
      avatarUrl: user.imageUrl,
      headline: user.profile.headline,
      trustScore: Number(user.profile.overallTrustScore ?? 0),
      completenessScore: Number(user.profile.completenessScore ?? 0),
      skills: user.skillAttestations,
      employment: user.employmentRecords,
    })
  })

  // ── POST /protocol/issuers — admin only ─────────────────────────────────
  app.post<{ Body: { did: string; name: string; domain: string; countryCode: string; logoUrl?: string; websiteUrl?: string } }>(
    '/protocol/issuers',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const result = await registerIssuer(req.body)
      return reply.status(201).send({ issuer: result, apiKey: result.apiKey })
    }
  )

  // ── POST /protocol/issue — issuer API key auth ───────────────────────────
  app.post<{
    Body: { issuerApiKey: string; profileDid: string; credentialType: string; schemaUrl: string; evidenceCid?: string; expiresAt?: string }
  }>('/protocol/issue', async (req, reply) => {
    try {
      const credential = await issueCredential(req.body)
      return reply.status(201).send({ credential })
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message: string }
      return reply.status(err.statusCode ?? 500).send({ error: err.message })
    }
  })

  // ── GET /protocol/linkedin/:username ─────────────────────────────────────
  // Used by the Chrome extension to look up a LinkedIn username.
  app.get('/protocol/linkedin/:username', async (req, reply) => {
    const { username } = req.params as { username: string }

    const profile = await app.db.profile.findFirst({
      where: {
        linkedinUrl: { contains: username },
        isPublic: true,
      },
      select: {
        user: { select: { did: true, kycTier: true, name: true } },
        overallTrustScore: true,
      },
    })

    if (!profile) {
      return reply.code(404).send(null)
    }

    return reply.header('Cache-Control', 'public, max-age=300').send({
      did: profile.user.did,
      fullName: profile.user.name,
      kycTier: profile.user.kycTier,
      trustScore: Number(profile.overallTrustScore ?? 0),
    })
  })
}
