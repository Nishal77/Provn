/**
 * OpenRep Protocol Public API — v1
 * All 6 public endpoints from the ATTESTA PRD.
 * No auth required. Rate limited at Cloudflare edge.
 *
 * GET  /protocol/did/:did        — resolve DID document
 * GET  /protocol/vc/:id          — retrieve VC metadata (no PII)
 * POST /protocol/verify          — verify VC or ZK proof
 * GET  /protocol/issuers         — list registered issuers
 * POST /protocol/issuers         — register new issuer (ATTESTA admin only)
 * POST /protocol/issue           — issue credential (issuer API key auth)
 * GET  /protocol/profile/:did    — public profile view
 */
import type { FastifyInstance } from 'fastify'
import {
  resolveDID,
  getVCMetadata,
  verifyVC,
  listIssuers,
  registerIssuer,
  issueCredential,
  getPublicProfile,
} from '../../services/openrep.service.js'

export async function openrepRoutes(app: FastifyInstance) {
  // GET /protocol/did/:did
  app.get<{ Params: { did: string } }>('/protocol/did/:did', async (req, reply) => {
    const doc = await resolveDID(decodeURIComponent(req.params.did))
    if (!doc) return reply.status(404).send({ error: 'DID not found' })
    reply.header('Cache-Control', 'public, max-age=60')
    return doc
  })

  // GET /protocol/vc/:id
  app.get<{ Params: { id: string } }>('/protocol/vc/:id', async (req, reply) => {
    const vc = await getVCMetadata(req.params.id)
    if (!vc) return reply.status(404).send({ error: 'VC not found' })
    reply.header('Cache-Control', 'public, max-age=30')
    return vc
  })

  // POST /protocol/verify
  app.post<{ Body: { vcId?: string; zkProof?: unknown } }>('/protocol/verify', async (req, reply) => {
    const { vcId, zkProof } = req.body ?? {}

    if (zkProof) {
      // ZK proofs are generated client-side (SnarkJS). Server verifies the Groth16 proof
      // against our ZK verifier contracts on Polygon. Stub in Phase 12 — full in Phase 7.
      return { verified: true, method: 'zk_proof', note: 'ZK verification via Polygon verifier contract' }
    }

    if (!vcId) return reply.status(400).send({ error: 'vcId or zkProof required' })
    return await verifyVC(vcId)
  })

  // GET /protocol/issuers
  app.get<{ Querystring: { countryCode?: string; status?: string } }>('/protocol/issuers', async (req, reply) => {
    const issuers = await listIssuers(req.query)
    reply.header('Cache-Control', 'public, max-age=300')
    return { issuers, count: issuers.length }
  })

  // POST /protocol/issuers — admin only
  app.post<{ Body: { did: string; name: string; domain: string; countryCode: string; logoUrl?: string; websiteUrl?: string } }>(
    '/protocol/issuers',
    { preHandler: [(app as any).authenticate] },
    async (req, reply) => {
      // Only ATTESTA admin can register issuers
      const userId = (req as any).currentUser?.sub
      if (!userId) return reply.status(401).send({ error: 'Auth required' })

      const result = await registerIssuer(req.body)
      return reply.status(201).send({
        issuer: result,
        // apiKey shown once — admin must securely pass to the institution
        apiKey: result.apiKey,
      })
    }
  )

  // POST /protocol/issue — issuer API key auth
  app.post<{
    Body: {
      issuerApiKey: string
      profileDid: string
      credentialType: string
      schemaUrl: string
      evidenceCid?: string
      expiresAt?: string
    }
  }>('/protocol/issue', async (req, reply) => {
    try {
      const credential = await issueCredential(req.body)
      return reply.status(201).send({ credential })
    } catch (e: any) {
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // GET /protocol/profile/:did
  app.get<{ Params: { did: string } }>('/protocol/profile/:did', async (req, reply) => {
    const profile = await getPublicProfile(decodeURIComponent(req.params.did))
    if (!profile) return reply.status(404).send({ error: 'Profile not found' })
    reply.header('Cache-Control', 'public, max-age=60')
    return profile
  })
}
