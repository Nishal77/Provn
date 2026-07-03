import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import { SignJWT } from 'jose'

export async function POST() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false }, { status: 401 })
  const user = session.user as { id: string; did?: string; kycTier?: string }
  const secret = process.env.JWT_ACCESS_SECRET!
  const token = await new SignJWT({ sub: user.id, did: user.did ?? null, tier: user.kycTier ?? 'T6_SELF' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('60s')
    .sign(new TextEncoder().encode(secret))
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  const res = await fetch(`${apiUrl}/gdpr/erasure/request`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json()
  return NextResponse.json(json, { status: res.status })
}
