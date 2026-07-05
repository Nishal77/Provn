// Stripe webhook — proxied directly to Fastify with raw body intact.
// Fastify verifies the Stripe-Signature header; Next.js must NOT parse the body.
import { NextResponse } from 'next/server'

const API_URL = process.env.INTERNAL_API_URL ?? 'http://localhost:4000'

export async function POST(req: Request) {
  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''

  const res = await fetch(`${API_URL}/employers/billing/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': sig,
    },
    body: rawBody,
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
