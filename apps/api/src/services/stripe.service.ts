import type Stripe from 'stripe'

// Lazy-initialise Stripe — only needed when billing routes are hit.
// Key is optional; routes check env and return 503 if missing.
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured')
  // Dynamically import so the module graph doesn't fail at startup when key is absent
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const StripeLib = require('stripe') as typeof import('stripe')
  const StripeConstructor = (StripeLib as unknown as { default: typeof import('stripe') }).default ?? StripeLib
  _stripe = new StripeConstructor(key, { apiVersion: '2024-06-20' })
  return _stripe
}

// Price IDs — set in Stripe dashboard and referenced here.
// In dev these can be test-mode price IDs.
export const STRIPE_PRICES = {
  PER_HIRE: process.env.STRIPE_PRICE_PER_HIRE ?? 'price_per_hire_test',
  SUBSCRIPTION: process.env.STRIPE_PRICE_SUBSCRIPTION ?? 'price_subscription_test',
} as const

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

  // PER_HIRE → one-time payment mode; SUBSCRIPTION → recurring subscription mode
  const isSubscription = params.plan === 'SUBSCRIPTION'

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    customer_email: params.billingEmail,
    mode: isSubscription ? 'subscription' : 'payment',
    line_items: [
      {
        price: isSubscription ? STRIPE_PRICES.SUBSCRIPTION : STRIPE_PRICES.PER_HIRE,
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
