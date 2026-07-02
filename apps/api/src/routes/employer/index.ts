import type { FastifyInstance } from 'fastify'
import { employerRegisterRoute } from './register.js'
import { employerVerifyDomainRoute } from './verify-domain.js'
import { employerMeRoute } from './me.js'
import { employerBillingRoutes } from './billing.js'

export async function employerRoutes(app: FastifyInstance) {
  await employerRegisterRoute(app)
  await employerVerifyDomainRoute(app)
  await employerMeRoute(app)
  await employerBillingRoutes(app)
}
