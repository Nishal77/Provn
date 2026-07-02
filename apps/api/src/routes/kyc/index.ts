import type { FastifyInstance } from 'fastify'
import { initiateRoute } from './initiate.js'
import { webhookRoute } from './webhook.js'
import { statusRoute } from './status.js'

export async function kycRoutes(app: FastifyInstance) {
  await app.register(initiateRoute)
  await app.register(webhookRoute)
  await app.register(statusRoute)
}
