import type { FastifyInstance } from 'fastify'
import { createTrustChainService } from '../../services/trustchain.service.js'
import { authenticate } from '../../middleware/authenticate.js'

export async function trustChainRoutes(app: FastifyInstance) {
  const svc = createTrustChainService({ db: app.db })

  // ─── Trust graph ───────────────────────────────────────────────────────────

  // GET /trust/path?targetUserId=&maxHops=
  app.get('/trust/path', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as never as { currentUser: { sub: string } }).currentUser
    const q = req.query as { targetUserId?: string; maxHops?: string }
    if (!q.targetUserId) return reply.status(400).send({ error: 'targetUserId required' })
    const path = await svc.findTrustPath(user.sub, q.targetUserId, parseInt(q.maxHops ?? '3', 10))
    return reply.send({ path })
  })

  // ─── Referrals ─────────────────────────────────────────────────────────────

  // POST /referrals
  app.post('/referrals', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as never as { currentUser: { sub: string } }).currentUser
    const body = req.body as { candidateId: string; roleId: string; note?: string }
    if (!body.candidateId || !body.roleId) {
      return reply.status(400).send({ error: 'candidateId and roleId required' })
    }
    try {
      const referral = await svc.createReferral(user.sub, body)
      return reply.status(201).send({ referral })
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // GET /referrals?role=referrer|candidate
  app.get('/referrals', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as never as { currentUser: { sub: string } }).currentUser
    const q = req.query as { role?: string }
    const role = q.role === 'candidate' ? 'candidate' : 'referrer'
    const referrals = await svc.listReferrals(user.sub, role)
    return reply.send({ referrals })
  })

  // POST /referrals/:id/accept
  app.post('/referrals/:id/accept', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as never as { currentUser: { sub: string } }).currentUser
    const { id } = req.params as { id: string }
    try {
      const referral = await svc.acceptReferral(id, user.sub)
      return reply.send({ referral })
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // POST /referrals/:id/hire (ATTESTA internal — records hire + releases tranche 1)
  app.post('/referrals/:id/hire', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    try {
      const referral = await svc.recordHire(id)
      return reply.send({ referral })
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // POST /referrals/:id/tranche/:n (release tranche 2 or 3)
  app.post('/referrals/:id/tranche/:n', { preHandler: [authenticate] }, async (req, reply) => {
    const { id, n } = req.params as { id: string; n: string }
    const tranche = parseInt(n, 10) as 2 | 3
    if (tranche !== 2 && tranche !== 3) return reply.status(400).send({ error: 'Tranche must be 2 or 3' })
    try {
      const referral = await svc.releaseTranche(id, tranche)
      return reply.send({ referral })
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // ─── Bounty board ──────────────────────────────────────────────────────────

  // GET /bounties?domain=&minBounty=
  app.get('/bounties', { preHandler: [authenticate] }, async (req, reply) => {
    const q = req.query as { domain?: string; minBounty?: string }
    const bounties = await svc.getBountyBoard({
      domain: q.domain,
      minBounty: q.minBounty ? parseInt(q.minBounty, 10) : undefined,
    })
    return reply.send({ bounties })
  })

  // POST /bounties (employer posts bounty)
  app.post('/bounties', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as never as { currentUser: { sub: string } }).currentUser
    const body = req.body as { roleId: string; totalBountyUsd: number; domain?: string }
    if (!body.roleId || !body.totalBountyUsd) {
      return reply.status(400).send({ error: 'roleId and totalBountyUsd required' })
    }
    try {
      const bounty = await svc.postBounty(user.sub, body)
      return reply.status(201).send({ bounty })
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // GET /talent-scouts/leaderboard
  app.get('/talent-scouts/leaderboard', { preHandler: [authenticate] }, async (_req, reply) => {
    const leaderboard = await svc.getTalentScoutLeaderboard()
    return reply.send({ leaderboard })
  })
}
