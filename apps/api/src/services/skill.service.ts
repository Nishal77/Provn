// Skill attestation service — manages the full skill eval lifecycle.
//
// Flow:
//   candidate submits artifact
//     → record created (PENDING)
//     → SkillEvalJob created + enqueued to skill-eval-queue
//     → worker calls Python AI service → score returned
//     → status moves to SCORED
//     → skill-anchor worker writes result to Polygon (ANCHORING → ANCHORED)

import type { PrismaClient } from '@attesta/db'
import type { Queue } from 'bullmq'
import { env } from '../config/env.js'

export interface SubmitSkillInput {
  skillSlug: string
  artifactUrl?: string
  artifactType: 'GITHUB_REPO' | 'GIST' | 'URL' | 'TEXT'
  artifactText?: string
  description?: string
}

export interface SkillEvalResult {
  attestationId: string
  overallScore: number
  skillLevel: number
  categories: {
    code_quality: number
    best_practices: number
    complexity_handling: number
    readability: number
    correctness: number
  }
  reasoning: string
  plagiarismScore: number
  modelUsed: string
  evalDurationMs: number
}

export function createSkillService(deps: {
  db: PrismaClient
  skillEvalQueue: Queue
  skillAnchorQueue: Queue
}) {
  const { db, skillEvalQueue, skillAnchorQueue } = deps

  // ── submitAttestation ────────────────────────────────────────────────────
  // Creates an attestation record + eval job, enqueues for AI scoring.
  async function submitAttestation(userId: string, input: SubmitSkillInput) {
    if (!input.artifactUrl && !input.artifactText) {
      throw new Error('ARTIFACT_REQUIRED')
    }

    // One active attestation per skill per user — prevent spam
    const existing = await db.skillAttestation.findFirst({
      where: {
        userId,
        skillSlug: input.skillSlug,
        status: { in: ['PENDING', 'EVALUATING', 'SCORED', 'ANCHORING'] },
      },
    })
    if (existing) throw new Error('SKILL_ALREADY_PENDING')

    const attestation = await db.skillAttestation.create({
      data: {
        userId,
        skillSlug: input.skillSlug,
        artifactUrl: input.artifactUrl ?? null,
        artifactType: input.artifactType,
        status: 'PENDING',
      },
    })

    const evalJob = await db.skillEvalJob.create({
      data: {
        attestationId: attestation.id,
        status: 'QUEUED',
      },
    })

    const bullJob = await skillEvalQueue.add(
      'eval',
      {
        attestationId: attestation.id,
        evalJobId: evalJob.id,
        skillSlug: input.skillSlug,
        artifactUrl: input.artifactUrl ?? null,
        artifactType: input.artifactType,
        artifactText: input.artifactText ?? null,
        description: input.description ?? null,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 }, // 30s, 60s, 120s
        removeOnComplete: 100,
        removeOnFail: 50,
      }
    )

    await db.skillEvalJob.update({
      where: { id: evalJob.id },
      data: { queueJobId: String(bullJob.id) },
    })

    return { attestation, evalJobId: evalJob.id }
  }

  // ── recordEvalResult ─────────────────────────────────────────────────────
  // Called by the skill-eval worker after AI scoring completes.
  // Moves attestation to SCORED and enqueues anchor job.
  async function recordEvalResult(result: SkillEvalResult) {
    const { attestationId } = result

    if (result.plagiarismScore > 0.85) {
      await db.$transaction([
        db.skillAttestation.update({
          where: { id: attestationId },
          data: {
            status: 'FAILED',
            plagiarismScore: result.plagiarismScore,
            aiEvalScore: result.overallScore,
            aiEvalReport: result as unknown as Record<string, unknown>,
          },
        }),
        db.skillEvalJob.update({
          where: { attestationId },
          data: { status: 'DONE', completedAt: new Date(), lastError: 'HIGH_PLAGIARISM_SCORE' },
        }),
      ])
      return
    }

    await db.$transaction([
      db.skillAttestation.update({
        where: { id: attestationId },
        data: {
          status: 'SCORED',
          skillLevel: result.skillLevel,
          aiEvalScore: result.overallScore,
          plagiarismScore: result.plagiarismScore,
          aiEvalReport: result as unknown as Record<string, unknown>,
        },
      }),
      db.skillEvalJob.update({
        where: { attestationId },
        data: { status: 'DONE', completedAt: new Date() },
      }),
    ])

    await skillAnchorQueue.add(
      'anchor',
      { attestationId },
      { attempts: 5, backoff: { type: 'exponential', delay: 15_000 }, removeOnComplete: 100 }
    )
  }

  // ── getAttestations ──────────────────────────────────────────────────────
  async function getAttestations(userId: string) {
    return db.skillAttestation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { evalJob: { select: { status: true, attempts: true, lastError: true } } },
    })
  }

  // ── getAttestationById ───────────────────────────────────────────────────
  async function getAttestationById(id: string, requestingUserId: string) {
    const record = await db.skillAttestation.findUnique({
      where: { id },
      include: { evalJob: true },
    })
    if (!record) throw new Error('NOT_FOUND')
    if (record.userId !== requestingUserId) throw new Error('FORBIDDEN')
    return record
  }

  // ── getPublicSkills ──────────────────────────────────────────────────────
  // Returns only ANCHORED skills — used for public profile display.
  async function getPublicSkills(userId: string) {
    return db.skillAttestation.findMany({
      where: { userId, status: 'ANCHORED' },
      orderBy: [{ skillLevel: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        skillSlug: true,
        skillLevel: true,
        aiEvalScore: true,
        chainTxHash: true,
        chainAnchoredAt: true,
        status: true,
      },
    })
  }

  return { submitAttestation, recordEvalResult, getAttestations, getAttestationById, getPublicSkills }
}
