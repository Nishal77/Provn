import { auth } from '@/auth'
import { NextResponse, type NextRequest } from 'next/server'
import { SignJWT } from 'jose'

async function mintToken(userId: string, did: string | null, tier: string) {
  const secret = process.env.JWT_ACCESS_SECRET!
  return new SignJWT({ sub: userId, did, tier })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('60s')
    .sign(new TextEncoder().encode(secret))
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false }, { status: 401 })
  const user = session.user as { id: string; did?: string; kycTier?: string }
  const token = await mintToken(user.id, user.did ?? null, user.kycTier ?? 'T6_SELF')
  const apiUrl = process.env.INTERNAL_API_URL ?? 'http://localhost:4000'
  const role = req.nextUrl.searchParams.get('role') ?? ''
  const res = await fetch(`${apiUrl}/zk/requests${role ? `?role=${role}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const json = await res.json()
  return NextResponse.json(json, { status: res.status })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false }, { status: 401 })
  const user = session.user as { id: string; did?: string; kycTier?: string }
  const token = await mintToken(user.id, user.did ?? null, user.kycTier ?? 'T6_SELF')
  const apiUrl = process.env.INTERNAL_API_URL ?? 'http://localhost:4000'
  const body = await req.json()
  const res = await fetch(`${apiUrl}/zk/request`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  return NextResponse.json(json, { status: res.status })
}
