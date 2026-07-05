import Stripe from 'stripe'
import { env } from '../config/env.js'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured')
  _stripe = new Stripe(key, { apiVersion: '2024-06-20' })
  return _stripe
}

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
