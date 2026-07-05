import { auth } from '@/auth'
import { NextResponse, type NextRequest } from 'next/server'
import { SignJWT } from 'jose'

async function mintToken(userId: string, did?: string, tier?: string) {
  const secret = process.env.JWT_ACCESS_SECRET!
  return new SignJWT({ sub: userId, did: did ?? null, tier: tier ?? 'T6_SELF' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('60s')
    .sign(new TextEncoder().encode(secret))
}

// POST /api/referrals/:id/accept  (candidate accepts)
// POST /api/referrals/:id/hire    (records hire + tranche 1)
// POST /api/referrals/:id/tranche/2 or /3
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as { id: string; did?: string; kycTier?: string }
  const token = await mintToken(user.id, user.did, user.kycTier)
  const apiUrl = process.env.INTERNAL_API_URL ?? 'http://localhost:4000'

  // Extract sub-path after [id] (e.g. /accept, /hire, /tranche/2)
  const url = new URL(req.url)
  const afterId = url.pathname.split(`/api/referrals/${params.id}`)[1] ?? ''

  const res = await fetch(`${apiUrl}/referrals/${params.id}${afterId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  return NextResponse.json(await res.json(), { status: res.status })
}
