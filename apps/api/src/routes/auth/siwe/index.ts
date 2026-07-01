import type { FastifyInstance } from 'fastify'
import { challengeRoute } from './challenge.js'
import { verifyRoute } from './verify.js'

export async function siweRoutes(app: FastifyInstance) {
  await app.register(challengeRoute)
  await app.register(verifyRoute)
}
