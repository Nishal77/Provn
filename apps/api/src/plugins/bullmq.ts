// BullMQ plugin — registers all queues and starts in-process workers.
//
// Queues:
//   employment-anchor-queue  — anchors co-signed employment records to Polygon
//   skill-eval-queue         — calls Python AI service to score skill artifacts
//   skill-anchor-queue       — anchors AI-scored skills to Polygon
//   trial-eval-queue         — calls Python AI service to score WorkProof Live trials
//
// Set WORKER_DISABLED=true to run workers in a separate pod (production split).

import { env } from '../config/env.js'

import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { Queue } from 'bullmq'
import { createEmploymentAnchorWorker } from '../workers/employment-anchor.worker.js'
import { createSkillEvalWorker } from '../workers/skill-eval.worker.js'
import { createSkillAnchorWorker } from '../workers/skill-anchor.worker.js'
import { createTrialEvalWorker } from '../workers/trial-eval.worker.js'
import { createRoleExtractWorker } from '../workers/role-extract.worker.js'

declare module 'fastify' {
  interface FastifyInstance {
    anchorQueue: Queue
    skillEvalQueue: Queue
    skillAnchorQueue: Queue
    trialEvalQueue: Queue
    roleExtractQueue: Queue
  }
}

export const bullmqPlugin = fp(async (app: FastifyInstance) => {
  // Parse Redis URL into separate options so BullMQ uses its own ioredis version (avoids version conflict).
  const { default: Redis } = await import('ioredis')
  const redisUrl = new URL(env.REDIS_URL)
  const isTLS = redisUrl.protocol === 'rediss:'
  const redisOpts = {
    host: redisUrl.hostname,
    port: Number(redisUrl.port) || 6379,
    username: redisUrl.username || undefined,
    password: redisUrl.password || undefined,
    maxRetriesPerRequest: null,
    ...(isTLS ? { tls: {} } : {}),
  }
  const connection = new Redis(redisOpts as never)

  const anchorQueue       = new Queue('employment-anchor-queue', { connection: connection as never })
  const skillEvalQueue    = new Queue('skill-eval-queue',        { connection: connection as never })
  const skillAnchorQueue  = new Queue('skill-anchor-queue',      { connection: connection as never })
  const trialEvalQueue    = new Queue('trial-eval-queue',        { connection: connection as never })
  const roleExtractQueue  = new Queue('role-extract-queue',      { connection: connection as never })

  app.decorate('anchorQueue',      anchorQueue)
  app.decorate('skillEvalQueue',   skillEvalQueue)
  app.decorate('skillAnchorQueue', skillAnchorQueue)
  app.decorate('trialEvalQueue',   trialEvalQueue)
  app.decorate('roleExtractQueue', roleExtractQueue)

  if (process.env.WORKER_DISABLED !== 'true') {
    createEmploymentAnchorWorker({ db: app.db, redis: connection as never })
    createSkillEvalWorker({ db: app.db, redis: connection as never, skillEvalQueue, skillAnchorQueue })
    createSkillAnchorWorker({ db: app.db, redis: connection as never })
    createTrialEvalWorker({ db: app.db, redis: connection as never })
    createRoleExtractWorker({ db: app.db, redis: connection as never })
    app.log.info('[bullmq] All workers started in-process (anchor + skill + trial + rolefit)')
  }

  app.addHook('onClose', async () => {
    await Promise.all([
      anchorQueue.close(),
      skillEvalQueue.close(),
      skillAnchorQueue.close(),
      trialEvalQueue.close(),
      roleExtractQueue.close(),
    ])
    await connection.quit()
  })
}, { name: 'bullmq', dependencies: ['redis', 'prisma'] })
