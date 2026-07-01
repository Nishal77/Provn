import type { FastifyInstance } from 'fastify'

export async function healthRoute(app: FastifyInstance) {
  app.get('/health', { logLevel: 'silent' }, async (_req, reply) => {
    // Check DB and Redis connectivity
    const [dbOk, redisOk] = await Promise.all([
      app.db.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      app.redis.ping().then((r) => r === 'PONG').catch(() => false),
    ])

    const healthy = dbOk && redisOk
    reply.code(healthy ? 200 : 503).send({
      status: healthy ? 'ok' : 'degraded',
      checks: { database: dbOk, redis: redisOk },
      timestamp: new Date().toISOString(),
    })
  })
}
