import { createHmac } from 'crypto'
import { auth } from '../../../../../auth'
import { NextResponse } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

function mintServiceToken(userId: string): string {
  const secret = process.env.JWT_ACCESS_SECRET
  if (!secret) throw new Error('JWT_ACCESS_SECRET not set')

  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, did: null, tier: 'T6_SELF', iat: now, exp: now + 60 })
  ).toString('base64url')

  const sig = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${sig}`
}

/**
 * GET /api/kyc/facetec/session
 * Proxies to Fastify GET /kyc/facetec/session.
 * Returns FaceTec session token + SDK init params for the browser.
 */
export async function GET() {
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

  const res = await fetch(`${API_URL}/kyc/facetec/session`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
