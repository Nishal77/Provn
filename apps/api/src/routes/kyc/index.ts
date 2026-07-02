import type { FastifyInstance } from 'fastify'
import { initiateRoute } from './initiate.js'
import { webhookRoute } from './webhook.js'
import { statusRoute } from './status.js'
import { facetecSessionRoute } from './facetec-session.js'
import { facetecValidateRoute } from './facetec-validate.js'

export async function kycRoutes(app: FastifyInstance) {
  // Step 1: FaceTec 3D liveness (must complete before Onfido doc check)
  await app.register(facetecSessionRoute)
  await app.register(facetecValidateRoute)

  // Step 2: Onfido document-only check (gated on FaceTec liveness pass)
  await app.register(initiateRoute)
  await app.register(webhookRoute)
  await app.register(statusRoute)
}
