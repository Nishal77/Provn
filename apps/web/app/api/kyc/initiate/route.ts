import { createHmac } from 'crypto'
import { auth } from '../../../../auth'
import { NextResponse } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

/**
 * Mints a short-lived Fastify-compatible HS256 JWT for the given user.
 *
 * Next.js server routes can't hold the user's own access token (the session
 * uses database sessions, not JWTs). We mint a 60-second service token using
 * the same JWT_ACCESS_SECRET that Fastify validates, so the proxied request
 * passes Fastify's `authenticate` middleware.
 */
function mintServiceToken(userId: string): string {
  const secret = process.env.JWT_ACCESS_SECRET
  if (!secret) throw new Error('JWT_ACCESS_SECRET not set')

  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      did: null,
      tier: 'T6_SELF',
      iat: now,
      exp: now + 60,
    })
  ).toString('base64url')

  const sigInput = `${header}.${payload}`
  const sig = createHmac('sha256', secret).update(sigInput).digest('base64url')
  return `${sigInput}.${sig}`
}

/**
 * POST /api/kyc/initiate
 *
 * Proxies to Fastify POST /kyc/initiate. Adds a short-lived service JWT so
 * Fastify's authenticate middleware accepts the request.
 */
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let token: string
  try {
    token = mintServiceToken(session.user.id)
  } catch {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const res = await fetch(`${API_URL}/kyc/initiate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
