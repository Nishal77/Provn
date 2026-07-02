import type Stripe from 'stripe'
import { env } from '../config/env.js'

// Lazy-initialise Stripe — only needed when billing routes are hit.
// Key is optional; routes check env and return 503 if missing.
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured')
  // Dynamically import so the module graph doesn't fail at startup when key is absent
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const StripeLib = require('stripe') as typeof import('stripe')
  const StripeConstructor = (StripeLib as unknown as { default: typeof import('stripe') }).default ?? StripeLib
  _stripe = new StripeConstructor(key, { apiVersion: '2024-06-20' })
  return _stripe
}

// Price IDs — throws at call-time if unconfigured so misconfiguration surfaces
// immediately as a readable error rather than a cryptic Stripe API rejection.
export function getStripePrices(): { PER_HIRE: string; SUBSCRIPTION: string } {
  const perHire = env.STRIPE_PRICE_PER_HIRE
  const subscription = env.STRIPE_PRICE_SUBSCRIPTION
  if (!perHire) throw new Error('STRIPE_PRICE_PER_HIRE not configured')
  if (!subscription) throw new Error('STRIPE_PRICE_SUBSCRIPTION not configured')
  return { PER_HIRE: perHire, SUBSCRIPTION: subscription }
}

export interface CreateCheckoutParams {
  employerId: string
  employerName: string
  billingEmail: string
  plan: 'PER_HIRE' | 'SUBSCRIPTION'
  successUrl: string
  cancelUrl: string
}

export async function createCheckoutSession(params: CreateCheckoutParams): Promise<string> {
  const stripe = getStripe()
  const prices = getStripePrices()

  // PER_HIRE → one-time payment mode; SUBSCRIPTION → recurring subscription mode
  const isSubscription = params.plan === 'SUBSCRIPTION'

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    customer_email: params.billingEmail,
    mode: isSubscription ? 'subscription' : 'payment',
    line_items: [
      {
        price: isSubscription ? prices.SUBSCRIPTION : prices.PER_HIRE,
        quantity: 1,
      },
    ],
    metadata: {
      employerId: params.employerId,
      plan: params.plan,
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  })

  return session.url!
}

export async function createOrGetCustomer(email: string, name: string): Promise<string> {
  const stripe = getStripe()
  const existing = await stripe.customers.list({ email, limit: 1 })
  if (existing.data.length > 0) return existing.data[0]!.id

  const customer = await stripe.customers.create({ email, name })
  return customer.id
}

export function constructWebhookEvent(rawBody: string, sig: string, secret: string): Stripe.Event {
  const stripe = getStripe()
  return stripe.webhooks.constructEvent(rawBody, sig, secret)
}
