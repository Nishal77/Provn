import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate.js'
import { createEmployerService } from '../../services/employer.service.js'
import { createCheckoutSession, constructWebhookEvent } from '../../services/stripe.service.js'

export async function employerBillingRoutes(app: FastifyInstance) {
  // POST /employers/billing/checkout
  // Creates a Stripe Checkout session and returns the redirect URL
  app.post(
    '/employers/billing/checkout',
    {
      preHandler: [authenticate],
      config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
    },
    async (req, reply) => {
      const userId = req.currentUser.sub

      const body = req.body as { plan?: 'PER_HIRE' | 'SUBSCRIPTION' }
      if (!body.plan || !['PER_HIRE', 'SUBSCRIPTION'].includes(body.plan)) {
        return reply.code(400).send({
          success: false,
          error: { code: 'INVALID_PLAN', message: 'plan must be PER_HIRE or SUBSCRIPTION.' },
        })
      }

      const svc = createEmployerService({ db: app.db })
      const employer = await svc.getEmployerForUser(userId)
      if (!employer) {
        return reply.code(404).send({
          success: false,
          error: { code: 'NO_EMPLOYER', message: 'No employer account found.' },
        })
      }

      if (employer.status !== 'ACTIVE') {
        return reply.code(403).send({
          success: false,
          error: { code: 'DOMAIN_NOT_VERIFIED', message: 'Verify domain before billing.' },
        })
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://attesta.io'

      try {
        const checkoutUrl = await createCheckoutSession({
          employerId: employer.id,
          employerName: employer.name,
          billingEmail: employer.billingEmail ?? '',
          plan: body.plan,
          successUrl: `${appUrl}/employer/billing/success?plan=${body.plan}`,
          cancelUrl: `${appUrl}/employer/billing`,
        })

        return reply.send({ success: true, data: { checkoutUrl } })
      } catch (err) {
        app.log.error({ err, userId }, 'Stripe checkout session creation failed')
        return reply.code(503).send({
          success: false,
          error: { code: 'STRIPE_UNAVAILABLE', message: 'Billing service unavailable.' },
        })
      }
    }
  )

  // POST /employers/billing/webhook
  // Stripe webhook — receives raw body (must not be parsed as JSON by Fastify)
  app.post(
    '/employers/billing/webhook',
    {
      config: {
        // rawBody: true is needed — see app.ts addContentTypeParser for 'application/json' on this route
        rawBody: true,
      },
    },
    async (req, reply) => {
      const sig = req.headers['stripe-signature'] as string | undefined
      const secret = process.env.STRIPE_WEBHOOK_SECRET

      if (!sig || !secret) {
        return reply.code(400).send({ error: 'Missing Stripe signature or webhook secret.' })
      }

      let event: { type: string; data: { object: Record<string, unknown> } }

      try {
        event = constructWebhookEvent(req.rawBody as string, sig, secret) as typeof event
      } catch (err) {
        app.log.warn({ err }, 'Stripe webhook signature verification failed')
        return reply.code(400).send({ error: 'Invalid signature.' })
      }

      const svc = createEmployerService({ db: app.db })

      try {
        await svc.handleStripeWebhook(event)
      } catch (err) {
        app.log.error({ err, eventType: event.type }, 'Stripe webhook handler failed')
        // Return 200 so Stripe doesn't retry — log for manual recovery
        return reply.code(200).send({ received: true, error: 'Handler failed' })
      }

      return reply.code(200).send({ received: true })
    }
  )
}
