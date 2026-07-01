import fp from 'fastify-plugin'
import rateLimit from '@fastify/rate-limit'

export const rateLimitPlugin = fp(async (app) => {
  await app.register(rateLimit, {
    // Global default: 100 requests per minute per IP
    max: 100,
    timeWindow: '1 minute',
    redis: app.redis,
    // Auth endpoints get stricter limits (set per-route via config)
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: (_req, context) => ({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests. Try again in ${context.after}.`,
      },
    }),
  })
})
