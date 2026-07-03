import { auth } from '@/auth'
import { NextResponse, type NextRequest } from 'next/server'
import { SignJWT } from 'jose'

async function mintToken(userId: string, did?: string, tier?: string) {
  const secret = process.env.JWT_ACCESS_SECRET!
  return new SignJWT({ sub: userId, did: did ?? null, tier: tier ?? 'T6_SELF' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('60s')
    .sign(new TextEncoder().encode(secret))
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as { id: string; did?: string; kycTier?: string }
  const token = await mintToken(user.id, user.did, user.kycTier)
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  const role = req.nextUrl.searchParams.get('role') ?? 'candidate'
  const res = await fetch(`${apiUrl}/trials?role=${role}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return NextResponse.json(await res.json(), { status: res.status })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as { id: string; did?: string; kycTier?: string }
  const token = await mintToken(user.id, user.did, user.kycTier)
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  const body = await req.json()
  const res = await fetch(`${apiUrl}/trials`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return NextResponse.json(await res.json(), { status: res.status })
}
