// BullMQ plugin — registers the employment-anchor-queue on the Fastify instance
// and starts the in-process worker.
//
// In production you can split workers to a separate pod by setting
// WORKER_ONLY=true (worker-only process) or WORKER_DISABLED=true (API-only process).

import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { Queue } from 'bullmq'
import { createEmploymentAnchorWorker } from '../workers/employment-anchor.worker.js'

declare module 'fastify' {
  interface FastifyInstance {
    anchorQueue: Queue
  }
}

export const bullmqPlugin = fp(async (app: FastifyInstance) => {
  // BullMQ shares the same Redis connection as the rest of the app.
  // We create a dedicated ioredis instance because BullMQ recommends not
  // sharing a connection that uses blocking commands with non-blocking commands.
  const { default: Redis } = await import('ioredis')
  const connection = new Redis(app.redis.options as ConstructorParameters<typeof Redis>[0], {
    maxRetriesPerRequest: null, // required by BullMQ
  })

  const anchorQueue = new Queue('employment-anchor-queue', { connection })
  app.decorate('anchorQueue', anchorQueue)

  // Start the worker in-process unless explicitly disabled
  if (process.env.WORKER_DISABLED !== 'true') {
    createEmploymentAnchorWorker({ db: app.db, redis: connection })
    app.log.info('[bullmq] Employment anchor worker started in-process')
  }

  app.addHook('onClose', async () => {
    await anchorQueue.close()
    await connection.quit()
  })
}, { name: 'bullmq', dependencies: ['redis', 'prisma'] })
