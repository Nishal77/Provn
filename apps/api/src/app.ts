import Fastify from 'fastify'
import { env } from './config/env.js'
import { corsPlugin } from './plugins/cors.js'
import { cookiePlugin } from './plugins/cookie.js'
import { jwtPlugin } from './plugins/jwt.js'
import { redisPlugin } from './plugins/redis.js'
import { prismaPlugin } from './plugins/prisma.js'
import { rateLimitPlugin } from './plugins/rate-limit.js'
import { healthRoute } from './routes/health.js'
import { authRoutes } from './routes/auth/index.js'
import { profileRoutes } from './routes/profile/index.js'

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

  // 2. Infrastructure (DB, cache)
  await app.register(redisPlugin)
  await app.register(prismaPlugin)

  // 3. Auth tokens (needs redis for nonce store)
  await app.register(jwtPlugin)

  // 4. Rate limiting (needs redis for distributed counters)
  await app.register(rateLimitPlugin)

  // Routes
  await app.register(healthRoute)
  await app.register(authRoutes, { prefix: '/auth' })
  await app.register(profileRoutes, { prefix: '/profile' })

  return app
}
