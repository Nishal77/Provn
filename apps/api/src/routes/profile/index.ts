import type { FastifyInstance } from 'fastify'
import { meRoutes } from './me.js'
import { publicProfileRoute } from './public.js'

export async function profileRoutes(app: FastifyInstance) {
  await app.register(meRoutes)
  await app.register(publicProfileRoute)
}
