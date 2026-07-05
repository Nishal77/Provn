import { auth } from '@/auth'
import { NextResponse, type NextRequest } from 'next/server'
import { SignJWT } from 'jose'

async function mintToken(userId: string, did?: string, tier?: string) {
  const secret = process.env.JWT_ACCESS_SECRET!
  return new SignJWT({ sub: userId, did: did ?? null, tier: tier ?? 'T6_SELF' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('60s')
    .sign(new TextEncoder().encode(secret))
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as { id: string; did?: string; kycTier?: string }
  const token = await mintToken(user.id, user.did, user.kycTier)
  const apiUrl = process.env.INTERNAL_API_URL ?? 'http://localhost:4000'
  // Fetch role detail — use the list endpoint and find by id for now
  const res = await fetch(`${apiUrl}/roles`, { headers: { Authorization: `Bearer ${token}` } })
  const data = await res.json()
  const role = (data.roles ?? []).find((r: { id: string }) => r.id === params.id) ?? null
  return NextResponse.json({ role }, { status: role ? 200 : 404 })
}
