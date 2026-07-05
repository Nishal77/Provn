// Trial eval worker — calls Python AI service to score submitted trial work,
// then records TrialScore rows and updates trial status to SCORED.
// Anti-cheat: if keystroke entropy < 0.3 or paste count > 20, flags and scores penalized.

import { Worker } from 'bullmq'
import type { PrismaClient } from '@attesta/db'
import type { Redis as IORedis } from 'ioredis'
import { env } from '../config/env.js'

const AI_SERVICE = env.AI_SERVICE_URL
const ANTI_CHEAT_ENTROPY_MIN = 0.3
const ANTI_CHEAT_PASTE_MAX = 20

interface WorkerDeps {
  db: PrismaClient
  redis: IORedis
}

export function createTrialEvalWorker({ db, redis }: WorkerDeps) {
  return new Worker(
    'trial-eval-queue',
    async (job) => {
      const { trialId } = job.data as { trialId: string }

      const trial = await db.trial.findUnique({ where: { id: trialId } })
      if (!trial) { job.log(`Trial ${trialId} not found — skip`); return }
      if (trial.status !== 'EVALUATING') { job.log(`Trial ${trialId} not EVALUATING — skip`); return }

      // Anti-cheat gate
      const entropyScore = Number(trial.keystrokeEntropyScore ?? 1)
      const pasteCount = trial.pasteEventCount ?? 0
      const cheating = entropyScore < ANTI_CHEAT_ENTROPY_MIN || pasteCount > ANTI_CHEAT_PASTE_MAX

      try {
        const aiRes = await fetch(`${AI_SERVICE}/eval/trial`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trial_id: trialId,
            domain: trial.domain,
            role_title: trial.roleTitle,
            brief_markdown: trial.briefMarkdown ?? '',
            duration_minutes: trial.durationMinutes,
            recording_key: trial.recordingS3Key,
            anti_cheat: { entropy_score: entropyScore, paste_count: pasteCount },
          }),
          signal: AbortSignal.timeout(5 * 60 * 1000),
        })

        if (!aiRes.ok) throw new Error(`AI service ${aiRes.status}: ${await aiRes.text()}`)

        const report = await aiRes.json() as {
          dimensions: Record<string, { score: number; percentile: number; reasoning: string }>
        }

        // Persist dimension scores; apply anti-cheat penalty cap
        await db.$transaction(async (tx) => {
          for (const [dim, data] of Object.entries(report.dimensions)) {
            let score = Math.round(data.score)
            if (cheating && score > 60) score = 60 // hard cap if cheating detected
            await tx.trialScore.upsert({
              where: { trialId_dimension: { trialId, dimension: dim as never } },
              create: { id: `${trialId}-${dim}`, trialId, dimension: dim as never, score, percentile: data.percentile, reasoning: data.reasoning },
              update: { score, percentile: data.percentile, reasoning: data.reasoning },
            })
          }

          await tx.trial.update({
            where: { id: trialId },
            data: {
              status: 'SCORED',
              antiCheatFlags: cheating
                ? { flagged: true, entropyScore, pasteCount, penaltyApplied: true }
                : (trial.antiCheatFlags as never),
            },
          })
        })

        // Stripe Connect payout — transfer candidate fee if Stripe configured and not cheating
        if (!cheating && env.STRIPE_SECRET_KEY && trial.candidatePayoutAmountUsd) {
          try {
            const stripe = await import('stripe').then(m => new m.default(env.STRIPE_SECRET_KEY!))
            const candidate = await db.user.findUnique({ where: { id: trial.candidateId }, select: { stripeAccountId: true } })
            if (candidate?.stripeAccountId) {
              await stripe.transfers.create({
                amount: Math.round(Number(trial.candidatePayoutAmountUsd) * 100),
                currency: 'usd',
                destination: candidate.stripeAccountId,
                metadata: { trialId, candidateId: trial.candidateId },
              })
              job.log(`Payout $${trial.candidatePayoutAmountUsd} → candidate ${trial.candidateId}`)
            }
          } catch (payoutErr) {
            job.log(`Payout failed (non-fatal): ${payoutErr}`)
          }
        }

        job.log(`Trial ${trialId} scored. Cheating flag: ${cheating}`)
      } catch (err) {
        await db.trial.update({ where: { id: trialId }, data: { status: 'SUBMITTED' } }) // revert so retry can re-evaluate
        throw err
      }
    },
    {
      connection: redis as never,
      concurrency: 5,
      lockDuration: 10 * 60 * 1000,
    },
  )
}
