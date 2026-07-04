import type { PrismaClient } from '@prisma/client'
import type { Queue } from 'bullmq'
import { createId } from '@paralleldrive/cuid2'
import { env } from '../config/env.js'

interface Deps {
  db: PrismaClient
  trialEvalQueue: Queue
}

export function createTrialService({ db, trialEvalQueue }: Deps) {

  async function createTrial(employerId: string, input: {
    candidateId: string
    domain: string
    roleTitle: string
    briefMarkdown?: string
    durationMinutes?: number
    compensationCandidateUsd?: number
    compensationEmployerUsd?: number
  }) {
    const trial = await db.trial.create({
      data: {
        id: createId(),
        employerId,
        candidateId: input.candidateId,
        domain: input.domain as never,
        roleTitle: input.roleTitle,
        briefMarkdown: input.briefMarkdown,
        durationMinutes: input.durationMinutes ?? 120,
        compensationCandidateUsd: input.compensationCandidateUsd ?? 100,
        compensationEmployerUsd: input.compensationEmployerUsd ?? 300,
      },
    })
    // Create skeleton legal record
    await db.trialLegal.create({ data: { id: createId(), trialId: trial.id } })
    return trial
  }

  async function sendInvite(trialId: string, employerId: string) {
    const trial = await db.trial.findFirst({ where: { id: trialId, employerId } })
    if (!trial) throw Object.assign(new Error('Trial not found'), { statusCode: 404 })
    if (trial.status !== 'DRAFT') throw Object.assign(new Error('Already invited'), { statusCode: 409 })

    return db.trial.update({
      where: { id: trialId },
      data: {
        status: 'LEGAL_PENDING',
        invitedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
  }

  async function signWpta(trialId: string, candidateId: string, signature: string) {
    const trial = await db.trial.findFirst({ where: { id: trialId, candidateId } })
    if (!trial) throw Object.assign(new Error('Trial not found'), { statusCode: 404 })
    if (trial.status !== 'LEGAL_PENDING') throw Object.assign(new Error('Not awaiting signature'), { statusCode: 409 })
    if (!signature) throw Object.assign(new Error('Signature required'), { statusCode: 400 })

    await db.trialLegal.update({
      where: { trialId },
      data: { candidateSignature: signature, candidateSignedAt: new Date() },
    })
    return db.trial.update({
      where: { id: trialId },
      data: { status: 'READY' },
    })
  }

  async function launchSandbox(trialId: string, candidateId: string) {
    const trial = await db.trial.findFirst({
      where: { id: trialId, candidateId },
      include: { legal: true },
    })
    if (!trial) throw Object.assign(new Error('Trial not found'), { statusCode: 404 })
    if (trial.status !== 'READY') throw Object.assign(new Error('Not ready to launch'), { statusCode: 409 })
    if (!trial.legal?.candidateSignature) throw Object.assign(new Error('WPTA not signed'), { statusCode: 409 })

    // Spin up sandbox via Judge0 if configured, otherwise return dev stub URL
    const sandboxContainerId = `sandbox-${trialId}`
    let sandboxSessionUrl = `https://sandbox.attesta.io/session/${trialId}?token=stub-dev`

    if (env.JUDGE0_URL) {
      try {
        const resp = await fetch(`${env.JUDGE0_URL}/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(env.JUDGE0_AUTH_TOKEN ? { 'X-Auth-Token': env.JUDGE0_AUTH_TOKEN } : {}),
          },
          body: JSON.stringify({
            trial_id: trialId,
            domain: trial.domain,
            duration_minutes: trial.durationMinutes,
            container_id: sandboxContainerId,
          }),
          signal: AbortSignal.timeout(10_000),
        })
        if (resp.ok) {
          const data = await resp.json() as { session_url?: string }
          if (data.session_url) sandboxSessionUrl = data.session_url
        }
      } catch {
        // non-fatal — fall back to stub URL
      }
    }
    const expiresAt = new Date(Date.now() + trial.durationMinutes * 60 * 1000)

    return db.trial.update({
      where: { id: trialId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        expiresAt,
        sandboxContainerId,
        sandboxSessionUrl,
      },
    })
  }

  async function submitTrial(trialId: string, candidateId: string, payload: {
    keystrokeEntropyScore?: number
    pasteEventCount?: number
    antiCheatFlags?: Record<string, unknown>
    recordingS3Key?: string
  }) {
    const trial = await db.trial.findFirst({ where: { id: trialId, candidateId } })
    if (!trial) throw Object.assign(new Error('Trial not found'), { statusCode: 404 })
    if (trial.status !== 'IN_PROGRESS') throw Object.assign(new Error('Trial not in progress'), { statusCode: 409 })

    const updated = await db.trial.update({
      where: { id: trialId },
      data: {
        status: 'EVALUATING',
        submittedAt: new Date(),
        keystrokeEntropyScore: payload.keystrokeEntropyScore,
        pasteEventCount: payload.pasteEventCount ?? 0,
        antiCheatFlags: payload.antiCheatFlags as never,
        recordingS3Key: payload.recordingS3Key,
      },
    })

    await trialEvalQueue.add(
      'eval-trial',
      { trialId },
      {
        jobId: `trial-eval-${trialId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
      },
    )
    return updated
  }

  async function getScore(trialId: string, requesterId: string) {
    const trial = await db.trial.findFirst({
      where: {
        id: trialId,
        OR: [{ candidateId: requesterId }, { employerId: requesterId }],
      },
      include: { scores: true },
    })
    if (!trial) throw Object.assign(new Error('Trial not found'), { statusCode: 404 })
    return trial
  }

  async function getRecordingUrl(trialId: string, employerId: string) {
    const trial = await db.trial.findFirst({ where: { id: trialId, employerId } })
    if (!trial) throw Object.assign(new Error('Trial not found'), { statusCode: 404 })
    if (!trial.recordingS3Key) throw Object.assign(new Error('Recording not available'), { statusCode: 404 })

    // In production: generate signed S3 URL (15min TTL)
    const signedUrl = `https://recordings.attesta.io/${trial.recordingS3Key}?expires=${Date.now() + 900_000}`
    return { signedUrl, expiresInSeconds: 900 }
  }

  async function listForCandidate(candidateId: string) {
    return db.trial.findMany({
      where: { candidateId },
      include: { scores: true, legal: { select: { candidateSignedAt: true, wptaDocumentCid: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async function listForEmployer(employerId: string) {
    return db.trial.findMany({
      where: { employerId },
      include: { scores: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  return { createTrial, sendInvite, signWpta, launchSandbox, submitTrial, getScore, getRecordingUrl, listForCandidate, listForEmployer }
}
