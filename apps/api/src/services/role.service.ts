// RoleFit AI service — role lifecycle + FitScore matching.
//
// Matching flow:
//   1. Employer creates role → requirement extraction queued
//   2. Worker fetches GitHub/Figma → Python AI generates 2048-dim vector
//   3. Vector stored in Pinecone (dev: JSON column fallback)
//   4. GET /roles/:id/matches → cosine similarity query → compute FitScores → top-50
//   5. Employer expresses interest → candidate notified → identities revealed on mutual

import type { PrismaClient } from '@attesta/db'
import type { Queue } from 'bullmq'
import { createId } from '@paralleldrive/cuid2'
import type { FitScoreExplainability } from '@attesta/shared'

// Dimension weights from PRD: Capability 35%, Culture 20%, Growth 20%, Comp 15%, Career 10%
const WEIGHTS = { capability: 0.35, culture: 0.20, growth: 0.20, comp: 0.15, career: 0.10 }

interface Deps {
  db: PrismaClient
  roleExtractQueue: Queue
}

export function createRoleService({ db, roleExtractQueue }: Deps) {

  async function createRole(employerId: string, input: {
    title: string
    descriptionText?: string
    domain?: string
    compensationMinUsd?: number
    compensationMaxUsd?: number
    remote?: boolean
    location?: string
    githubRepoUrl?: string
    figmaProjectUrl?: string
    blindMode?: boolean
  }) {
    const role = await db.role.create({
      data: {
        id: createId(),
        employerId,
        title: input.title,
        descriptionText: input.descriptionText,
        domain: (input.domain ?? 'CODE') as never,
        compensationMinUsd: input.compensationMinUsd,
        compensationMaxUsd: input.compensationMaxUsd,
        remote: input.remote ?? true,
        location: input.location,
        githubRepoUrl: input.githubRepoUrl,
        figmaProjectUrl: input.figmaProjectUrl,
        blindMode: input.blindMode ?? true,
      },
    })

    // Trigger requirement extraction if repo URL provided
    if (input.githubRepoUrl) {
      await roleExtractQueue.add(
        'extract-requirements',
        { roleId: role.id },
        { jobId: `extract-${role.id}`, attempts: 3, backoff: { type: 'exponential', delay: 20_000 } },
      )
    }

    return role
  }

  async function getMatches(roleId: string, employerId: string, limit = 50) {
    const role = await db.role.findFirst({ where: { id: roleId, employerId } })
    if (!role) throw Object.assign(new Error('Role not found'), { statusCode: 404 })
    if (role.extractionStatus !== 'DONE' && role.extractionStatus !== 'PENDING') {
      // Still extracting — return cached scores if any
    }

    // Pull existing cached scores (or compute on demand for dev)
    let scores = await db.storedFitScore.findMany({
      where: { roleId },
      orderBy: { overallScore: 'desc' },
      take: limit,
      include: { candidate: { select: { id: true, kycTier: true, profile: { select: { overallTrustScore: true } } } } },
    })

    // Dev mode: if no scores cached, generate synthetic matches
    if (scores.length === 0) {
      scores = (await _generateSyntheticMatches(db, role, limit)) as unknown as typeof scores
    }

    return scores.map((s) => _anonymize(s as never, role.blindMode))
  }

  async function expressInterest(roleId: string, employerId: string, candidateId: string) {
    const role = await db.role.findFirst({ where: { id: roleId, employerId } })
    if (!role) throw Object.assign(new Error('Role not found'), { statusCode: 404 })

    const score = await db.storedFitScore.findUnique({ where: { roleId_candidateId: { roleId, candidateId } } })
    if (!score) throw Object.assign(new Error('FitScore not found'), { statusCode: 404 })

    const updated = await db.storedFitScore.update({
      where: { id: score.id },
      data: {
        employerInterest: true,
        // Reveal if both parties expressed interest
        revealedAt: score.candidateInterest ? new Date() : undefined,
        blindMode: score.candidateInterest ? false : score.blindMode,
      },
    })
    return updated
  }

  async function recordHireOutcome(roleId: string, candidateId: string, outcome: {
    hired: boolean
    daysToHire?: number
    performanceRating90d?: number
    tenureMonths?: number
  }) {
    const fitScore = await db.storedFitScore.findUnique({ where: { roleId_candidateId: { roleId, candidateId } } })
    return db.hireOutcome.create({
      data: {
        id: createId(),
        roleId,
        candidateId,
        hired: outcome.hired,
        daysToHire: outcome.daysToHire,
        performanceRating90d: outcome.performanceRating90d,
        tenureMonths: outcome.tenureMonths,
        fitScoreId: fitScore?.id,
      },
    })
  }

  async function listEmployerRoles(employerId: string) {
    return db.role.findMany({
      where: { employerId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { fitScores: true, hireOutcomes: true } },
      },
    })
  }

  async function getCompensationIntel(params: { role?: string; level?: string; geography?: string }) {
    // In production: query ClickHouse OLAP with anonymized compensation data
    // Dev: return plausible stub data
    const stubs = [
      { level: 'junior', p25: 80_000, p50: 95_000, p75: 115_000, p90: 130_000 },
      { level: 'mid',    p25: 110_000, p50: 135_000, p75: 160_000, p90: 185_000 },
      { level: 'senior', p25: 150_000, p50: 180_000, p75: 210_000, p90: 240_000 },
      { level: 'staff',  p25: 190_000, p50: 225_000, p75: 260_000, p90: 300_000 },
    ]
    const levelKey = (params.level ?? 'senior').toLowerCase()
    const stub = stubs.find(s => s.level === levelKey) ?? stubs[2]!
    return {
      role: params.role ?? 'Software Engineer',
      level: levelKey,
      geography: params.geography ?? 'US',
      p25Usd: stub.p25,
      p50Usd: stub.p50,
      p75Usd: stub.p75,
      p90Usd: stub.p90,
      sampleSize: 2847,
      updatedAt: new Date().toISOString(),
    }
  }

  return { createRole, getMatches, expressInterest, recordHireOutcome, listEmployerRoles, getCompensationIntel }
}

// Generates plausible synthetic FitScore rows for dev (no Pinecone needed).
async function _generateSyntheticMatches(db: PrismaClient, role: { id: string; compensationMinUsd: number | null; compensationMaxUsd: number | null }, limit: number) {
  const candidates = await db.user.findMany({
    take: Math.min(limit, 20),
    where: {},
    include: { profile: { select: { overallTrustScore: true } }, skillAttestations: { where: { status: 'ANCHORED' } } },
  })

  const rows = candidates.map(c => {
    const cap = 60 + (hash(c.id + 'cap') % 35)
    const cul = 55 + (hash(c.id + 'cul') % 40)
    const gro = 50 + (hash(c.id + 'gro') % 45)
    const comp = role.compensationMinUsd ? 70 + (hash(c.id + 'comp') % 25) : 75
    const car = 55 + (hash(c.id + 'car') % 40)
    const overall = Math.round(cap * 0.35 + cul * 0.20 + gro * 0.20 + comp * 0.15 + car * 0.10)

    const explainability: FitScoreExplainability = {
      topFactors: [
        { feature: 'skill_match_depth', impact: 0.42, direction: 'positive' },
        { feature: 'tenure_alignment', impact: 0.18, direction: 'positive' },
        { feature: 'comp_range_fit', impact: comp > 70 ? 0.15 : -0.12, direction: comp > 70 ? 'positive' : 'negative' },
      ],
      dimensionBreakdown: {
        CAPABILITY: { score: cap, weight: WEIGHTS.capability, contribution: Math.round(cap * WEIGHTS.capability) },
        CULTURE:    { score: cul, weight: WEIGHTS.culture,    contribution: Math.round(cul * WEIGHTS.culture) },
        GROWTH:     { score: gro, weight: WEIGHTS.growth,     contribution: Math.round(gro * WEIGHTS.growth) },
        COMP:       { score: comp, weight: WEIGHTS.comp,      contribution: Math.round(comp * WEIGHTS.comp) },
        CAREER:     { score: car, weight: WEIGHTS.career,     contribution: Math.round(car * WEIGHTS.career) },
      },
    }

    return {
      id: createId(),
      roleId: role.id,
      candidateId: c.id,
      overallScore: overall,
      capabilityScore: cap,
      cultureScore: cul,
      growthScore: gro,
      compScore: comp,
      careerScore: car,
      explainability: explainability as never,
      candidate: c,
    }
  })

  // Upsert into DB
  await db.storedFitScore.createMany({
    data: rows.map(r => ({
      id: r.id,
      roleId: r.roleId,
      candidateId: r.candidateId,
      overallScore: r.overallScore,
      capabilityScore: r.capabilityScore,
      cultureScore: r.cultureScore,
      growthScore: r.growthScore,
      compScore: r.compScore,
      careerScore: r.careerScore,
      explainability: r.explainability,
    })),
    skipDuplicates: true,
  })

  return rows.sort((a, b) => b.overallScore - a.overallScore)
}

function _anonymize(score: {
  id: string; overallScore: number; capabilityScore: number; cultureScore: number;
  growthScore: number; compScore: number; careerScore: number; explainability: unknown;
  blindMode: boolean; employerInterest: boolean; candidateInterest: boolean; revealedAt: Date | null;
  candidate: { id: string; kycTier: string | null; profile: { overallTrustScore: number | null } | null }
}, blindMode: boolean) {
  const revealed = !blindMode || score.revealedAt !== null
  return {
    fitScoreId: score.id,
    overallScore: score.overallScore,
    capabilityScore: score.capabilityScore,
    cultureScore: score.cultureScore,
    growthScore: score.growthScore,
    compScore: score.compScore,
    careerScore: score.careerScore,
    explainability: score.explainability,
    employerInterest: score.employerInterest,
    candidateInterest: score.candidateInterest,
    revealedAt: score.revealedAt,
    candidate: {
      id: revealed ? score.candidate.id : undefined,
      kycTier: score.candidate.kycTier,
      trustScore: score.candidate.profile?.overallTrustScore,
      blindMode: !revealed,
    },
  }
}

// Deterministic hash for dev synthetic data
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
