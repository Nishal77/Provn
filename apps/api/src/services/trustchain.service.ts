// TrustChain Talent service.
//
// Trust graph queries run against PostgreSQL TrustEdge table (dev mode).
// Production: delegate to Neo4j AuraDB via bolt:// driver + GraphSAGE embeddings.
//
// Anti-collusion: Isolation Forest score > 0.7 → flag referral for manual review.

import type { PrismaClient } from '@prisma/client'
import { createId } from '@paralleldrive/cuid2'

interface Deps { db: PrismaClient }

export function createTrustChainService({ db }: Deps) {

  // ─── Trust graph ───────────────────────────────────────────────────────────

  async function upsertTrustEdge(fromUserId: string, toUserId: string, opts: {
    coEmploymentMonths?: number
    strengthScore?: number
    sourceType?: string
    evidenceTxHash?: string
  }) {
    const months = opts.coEmploymentMonths ?? 0
    // Strength = log(months + 1) / log(121) capped at 0.99
    const strength = Math.min(0.99, Math.log(months + 1) / Math.log(121))

    return db.trustEdge.upsert({
      where: { fromUserId_toUserId: { fromUserId, toUserId } },
      create: {
        id: createId(),
        fromUserId,
        toUserId,
        strengthScore: opts.strengthScore ?? strength,
        coEmploymentMonths: months,
        sourceType: opts.sourceType ?? 'co_employment',
        evidenceTxHash: opts.evidenceTxHash,
      },
      update: {
        coEmploymentMonths: months,
        strengthScore: opts.strengthScore ?? strength,
        evidenceTxHash: opts.evidenceTxHash,
      },
    })
  }

  // BFS path discovery: "2 hops from Company X via trusted mutual"
  // Dev: runs in Postgres. Prod: Neo4j Cypher shortest-path query.
  async function findTrustPath(fromUserId: string, targetUserId: string, maxHops = 3) {
    // BFS up to maxHops
    type NodeMap = Map<string, { prev: string | null; strength: number; hop: number }>
    const visited: NodeMap = new Map()
    visited.set(fromUserId, { prev: null, strength: 1, hop: 0 })
    const queue: string[] = [fromUserId]

    while (queue.length > 0) {
      const current = queue.shift()!
      const node = visited.get(current)!
      if (node.hop >= maxHops) continue

      const edges = await db.trustEdge.findMany({
        where: { fromUserId: current },
        select: { toUserId: true, strengthScore: true },
      })

      for (const e of edges) {
        if (visited.has(e.toUserId)) continue
        const strength = node.strength * Number(e.strengthScore)
        visited.set(e.toUserId, { prev: current, strength, hop: node.hop + 1 })
        if (e.toUserId === targetUserId) {
          // Reconstruct path
          const path: { userId: string; strengthToNext?: number }[] = []
          let cur: string | null = targetUserId
          while (cur) {
            const n = visited.get(cur)!
            path.unshift({ userId: cur, strengthToNext: n.strength })
            cur = n.prev
          }
          return { nodes: path, totalStrength: strength, hopCount: node.hop + 1 }
        }
        queue.push(e.toUserId)
      }
    }
    return null // no path found within maxHops
  }

  // ─── Referrals ─────────────────────────────────────────────────────────────

  async function createReferral(referrerId: string, input: {
    candidateId: string
    roleId: string
    note?: string
  }) {
    // Anti-collusion: check if referrer ↔ candidate trust edge exists
    const edge = await db.trustEdge.findUnique({
      where: { fromUserId_toUserId: { fromUserId: referrerId, toUserId: input.candidateId } },
    })
    // Stub anti-collusion score — prod uses Isolation Forest
    const antiCollusionScore = edge
      ? Math.max(0, 0.1 - Number(edge.strengthScore) * 0.1)
      : 0.3

    // Block if score > 0.7 (highly suspicious)
    if (antiCollusionScore > 0.7) {
      throw Object.assign(new Error('Anti-collusion check failed — relationship too weak or suspicious'), { statusCode: 422 })
    }

    return db.referral.create({
      data: {
        id: createId(),
        referrerId,
        candidateId: input.candidateId,
        roleId: input.roleId,
        note: input.note,
        antiCollusionScore,
      },
    })
  }

  async function acceptReferral(referralId: string, candidateId: string) {
    const ref = await db.referral.findFirst({ where: { id: referralId, candidateId } })
    if (!ref) throw Object.assign(new Error('Referral not found'), { statusCode: 404 })
    if (ref.status !== 'PENDING') throw Object.assign(new Error('Not pending'), { statusCode: 409 })
    return db.referral.update({ where: { id: referralId }, data: { status: 'ACCEPTED' } })
  }

  async function recordHire(referralId: string) {
    const ref = await db.referral.findUnique({ where: { id: referralId } })
    if (!ref) throw Object.assign(new Error('Referral not found'), { statusCode: 404 })

    // In prod: call BountyRegistry.createEscrow() via viem → get contractAddress
    const contractAddress = `0xescrow${referralId.slice(0, 8)}`

    const updated = await db.referral.update({
      where: { id: referralId },
      data: {
        status: 'HIRED',
        hireTimestamp: new Date(),
        contractAddress,
        tranche1PaidAt: new Date(), // released immediately at hire
        txHashTranche1: `0xtx1-${referralId.slice(0, 8)}`,
      },
    })

    // Boost trust edge strength after successful hire
    await upsertTrustEdge(ref.referrerId, ref.candidateId, {
      sourceType: 'referral_success',
      strengthScore: 0.95,
    })

    return updated
  }

  async function releaseTranche(referralId: string, tranche: 2 | 3) {
    const ref = await db.referral.findUnique({ where: { id: referralId } })
    if (!ref) throw Object.assign(new Error('Referral not found'), { statusCode: 404 })

    if (tranche === 2) {
      if (!ref.hireTimestamp) throw Object.assign(new Error('Not hired yet'), { statusCode: 409 })
      const daysSince = (Date.now() - ref.hireTimestamp.getTime()) / 86_400_000
      // Dev: skip 90-day check; prod checks on-chain
      return db.referral.update({
        where: { id: referralId },
        data: {
          status: 'TRANCHE2_RELEASED',
          tranche2PaidAt: new Date(),
          txHashTranche2: `0xtx2-${referralId.slice(0, 8)}`,
        },
      })
    }

    return db.referral.update({
      where: { id: referralId },
      data: {
        status: 'TRANCHE3_RELEASED',
        tranche3PaidAt: new Date(),
        txHashTranche3: `0xtx3-${referralId.slice(0, 8)}`,
      },
    })
  }

  async function listReferrals(userId: string, role: 'referrer' | 'candidate') {
    const where = role === 'referrer' ? { referrerId: userId } : { candidateId: userId }
    return db.referral.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        role: { select: { title: true, domain: true } },
        referrer: { select: { id: true, profile: { select: { overallTrustScore: true } } } },
      },
    })
  }

  // ─── Bounty board ──────────────────────────────────────────────────────────

  async function postBounty(employerId: string, input: {
    roleId: string
    totalBountyUsd: number
    domain?: string
    expiresAt?: Date
  }) {
    if (input.totalBountyUsd < 1000 || input.totalBountyUsd > 15_000) {
      throw Object.assign(new Error('Bounty must be $1,000–$15,000'), { statusCode: 400 })
    }
    return db.bountyListing.create({
      data: {
        id: createId(),
        employerId,
        roleId: input.roleId,
        totalBountyUsd: input.totalBountyUsd,
        domain: input.domain ?? 'CODE',
        expiresAt: input.expiresAt ?? new Date(Date.now() + 90 * 86_400_000),
      },
    })
  }

  async function getBountyBoard(filters: { domain?: string; minBounty?: number }) {
    return db.bountyListing.findMany({
      where: {
        status: 'OPEN',
        ...(filters.domain ? { domain: filters.domain } : {}),
        ...(filters.minBounty ? { totalBountyUsd: { gte: filters.minBounty } } : {}),
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { role: { select: { id: true, title: true, domain: true, remote: true } } },
      orderBy: { totalBountyUsd: 'desc' },
      take: 100,
    })
  }

  // ─── Talent Scout leaderboard ──────────────────────────────────────────────

  async function getTalentScoutLeaderboard(limit = 10) {
    // Sum paid referral bounties per referrer
    const results = await db.referral.groupBy({
      by: ['referrerId'],
      where: { status: { in: ['TRANCHE1_RELEASED', 'TRANCHE2_RELEASED', 'TRANCHE3_RELEASED', 'COMPLETED'] } },
      _count: { id: true },
      _sum: { bountyTotalUsd: true },
      orderBy: { _sum: { bountyTotalUsd: 'desc' } },
      take: limit,
    })
    return results.map(r => ({
      referrerId: r.referrerId,
      referralCount: r._count.id,
      totalEarnedUsd: r._sum.bountyTotalUsd ?? 0,
    }))
  }

  return {
    upsertTrustEdge,
    findTrustPath,
    createReferral,
    acceptReferral,
    recordHire,
    releaseTranche,
    listReferrals,
    postBounty,
    getBountyBoard,
    getTalentScoutLeaderboard,
  }
}
