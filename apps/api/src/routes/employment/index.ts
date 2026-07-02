// Employment routes aggregator.
// Registration order matters: countersign routes must come before the generic
// /:id route, otherwise Fastify would match /countersign/... as an ID.
import type { FastifyInstance } from 'fastify'
import { employmentCreateRoute }        from './create.js'
import { employmentListRoute }           from './list.js'
import { employmentCountersignRoutes }   from './countersign.js'
import { employmentGetRoute }            from './get.js'
import { employmentCancelRoute }         from './cancel.js'
import { employmentPendingReviewRoute }  from './pending-review.js'

export async function employmentRoutes(app: FastifyInstance) {
  await employmentCreateRoute(app)
  await employmentListRoute(app)
  await employmentCountersignRoutes(app)   // /employment/countersign/:token — must precede /:id
  await employmentPendingReviewRoute(app)  // /employment/pending-review — must precede /:id
  await employmentGetRoute(app)
  await employmentCancelRoute(app)
}
