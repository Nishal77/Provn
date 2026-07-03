import Fastify from 'fastify'
import fastifyRawBody from 'fastify-raw-body'
import { env } from './config/env.js'
import { corsPlugin } from './plugins/cors.js'
import { cookiePlugin } from './plugins/cookie.js'
import { jwtPlugin } from './plugins/jwt.js'
import { redisPlugin } from './plugins/redis.js'
import { prismaPlugin } from './plugins/prisma.js'
import { rateLimitPlugin } from './plugins/rate-limit.js'
import { bullmqPlugin } from './plugins/bullmq.js'
import { healthRoute } from './routes/health.js'
import { authRoutes } from './routes/auth/index.js'
import { profileRoutes } from './routes/profile/index.js'
import { kycRoutes } from './routes/kyc/index.js'
import { employerRoutes } from './routes/employer/index.js'
import { employmentRoutes } from './routes/employment/index.js'
import { skillRoutes } from './routes/skills/index.js'
import { zkRoutes } from './routes/zk/index.js'
import { protocolRoutes } from './routes/protocol/index.js'
import { gdprRoutes } from './routes/gdpr/index.js'
import { trialRoutes } from './routes/trials/index.js'
import { roleRoutes } from './routes/roles/index.js'

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport:
        env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  })

  // Plugins are registered in dependency order:
  // 1. Security / transport layer
  await app.register(corsPlugin)
  await app.register(cookiePlugin)

  // Raw body access — needed for HMAC signature verification on Onfido webhooks.
  // Must be registered before any route that reads req.rawBody.
  await app.register(fastifyRawBody, { field: 'rawBody', global: false, encoding: 'utf8' })

  // 2. Infrastructure (DB, cache)
  await app.register(redisPlugin)
  await app.register(prismaPlugin)

  // 3. Auth tokens (needs redis for nonce store)
  await app.register(jwtPlugin)

  // 4. Rate limiting (needs redis for distributed counters)
  await app.register(rateLimitPlugin)
  await app.register(bullmqPlugin)

  // Routes
  await app.register(healthRoute)
  await app.register(authRoutes, { prefix: '/auth' })
  await app.register(profileRoutes, { prefix: '/profile' })
  await app.register(kycRoutes)
  await app.register(employerRoutes)
  await app.register(employmentRoutes)
  await app.register(skillRoutes)
  await app.register(zkRoutes)
  await app.register(protocolRoutes)
  await app.register(gdprRoutes)
  await app.register(trialRoutes)
  await app.register(roleRoutes)

  return app
}
