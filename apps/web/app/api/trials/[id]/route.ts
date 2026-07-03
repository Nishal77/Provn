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
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  const res = await fetch(`${apiUrl}/trials/${params.id}/score`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return NextResponse.json(await res.json(), { status: res.status })
}
