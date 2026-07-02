import { auth } from '../../../../auth'
import { NextResponse } from 'next/server'
import { SignJWT } from 'jose'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

async function mintServiceToken(userId: string, did: string | null, tier: string): Promise<string> {
  const secret = process.env.JWT_ACCESS_SECRET
  if (!secret) throw new Error('JWT_ACCESS_SECRET not set')

  return new SignJWT({ sub: userId, did, tier })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('60s')
    .sign(new TextEncoder().encode(secret))
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()

  const token = await mintServiceToken(
    session.user.id,
    (session.user as { did?: string }).did ?? null,
    (session.user as { kycTier?: string }).kycTier ?? 'T6_SELF'
  )

  const res = await fetch(`${API_URL}/employers/billing/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
