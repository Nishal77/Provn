import fp from 'fastify-plugin'
import Redis from 'ioredis'
import { env } from '../config/env.js'

// Extend Fastify's type system so app.redis is typed everywhere
declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis
  }
}

export const redisPlugin = fp(async (app) => {
  const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
  })

  await redis.connect()

  redis.on('error', (err) => {
    app.log.error({ err }, 'Redis error')
  })

  app.decorate('redis', redis)

  app.addHook('onClose', async () => {
    await redis.quit()
  })
})
