// BullMQ plugin — registers all queues and starts in-process workers.
//
// Queues:
//   employment-anchor-queue  — anchors co-signed employment records to Polygon
//   skill-eval-queue         — calls Python AI service to score skill artifacts
//   skill-anchor-queue       — anchors AI-scored skills to Polygon
//   trial-eval-queue         — calls Python AI service to score WorkProof Live trials
//
// Set WORKER_DISABLED=true to run workers in a separate pod (production split).

import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { Queue } from 'bullmq'
import { createEmploymentAnchorWorker } from '../workers/employment-anchor.worker.js'
import { createSkillEvalWorker } from '../workers/skill-eval.worker.js'
import { createSkillAnchorWorker } from '../workers/skill-anchor.worker.js'
import { createTrialEvalWorker } from '../workers/trial-eval.worker.js'

declare module 'fastify' {
  interface FastifyInstance {
    anchorQueue: Queue
    skillEvalQueue: Queue
    skillAnchorQueue: Queue
    trialEvalQueue: Queue
  }
}

export const bullmqPlugin = fp(async (app: FastifyInstance) => {
  const { default: Redis } = await import('ioredis')
  const connection = new Redis(app.redis.options as ConstructorParameters<typeof Redis>[0], {
    maxRetriesPerRequest: null,
  })

  const anchorQueue      = new Queue('employment-anchor-queue', { connection })
  const skillEvalQueue   = new Queue('skill-eval-queue',        { connection })
  const skillAnchorQueue = new Queue('skill-anchor-queue',      { connection })
  const trialEvalQueue   = new Queue('trial-eval-queue',        { connection })

  app.decorate('anchorQueue',      anchorQueue)
  app.decorate('skillEvalQueue',   skillEvalQueue)
  app.decorate('skillAnchorQueue', skillAnchorQueue)
  app.decorate('trialEvalQueue',   trialEvalQueue)

  if (process.env.WORKER_DISABLED !== 'true') {
    createEmploymentAnchorWorker({ db: app.db, redis: connection })
    createSkillEvalWorker({ db: app.db, redis: connection, skillEvalQueue, skillAnchorQueue })
    createSkillAnchorWorker({ db: app.db, redis: connection })
    createTrialEvalWorker({ db: app.db, redis: connection })
    app.log.info('[bullmq] All workers started in-process (anchor + skill + trial)')
  }

  app.addHook('onClose', async () => {
    await Promise.all([
      anchorQueue.close(),
      skillEvalQueue.close(),
      skillAnchorQueue.close(),
      trialEvalQueue.close(),
    ])
    await connection.quit()
  })
}, { name: 'bullmq', dependencies: ['redis', 'prisma'] })
