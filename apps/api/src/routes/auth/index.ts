import type { FastifyInstance } from 'fastify'
import { signupRoute } from './signup.js'
import { loginRoute } from './login.js'
import { logoutRoute } from './logout.js'
import { refreshRoute } from './refresh.js'
import { siweRoutes } from './siwe/index.js'
import { githubConnectRoutes } from './github-connect.js'

export async function authRoutes(app: FastifyInstance) {
  await app.register(signupRoute)
  await app.register(loginRoute)
  await app.register(logoutRoute)
  await app.register(refreshRoute)
  await app.register(siweRoutes, { prefix: '/wallet' })
  await app.register(githubConnectRoutes)
}
