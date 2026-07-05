import { createHmac } from 'crypto'
import { auth } from '../../../../../auth'
import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.INTERNAL_API_URL ?? 'http://localhost:4000'

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
 * POST /api/kyc/facetec/validate
 * Proxies to Fastify POST /kyc/facetec/validate.
 * Forwards encrypted faceScan data from FaceTec SDK to our backend for validation.
 */
export async function POST(req: NextRequest) {
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

  const body = await req.text()

  const res = await fetch(`${API_URL}/kyc/facetec/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body,
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
