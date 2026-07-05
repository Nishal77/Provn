import { createHmac } from 'crypto'
import { auth } from '../../../../auth'
import { NextResponse } from 'next/server'

const API_URL = process.env.INTERNAL_API_URL ?? 'http://localhost:4000'

function mintServiceToken(userId: string): string {
  const secret = process.env.JWT_ACCESS_SECRET
  if (!secret) throw new Error('JWT_ACCESS_SECRET not set')
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ sub: userId, did: null, tier: 'T6_SELF', iat: now, exp: now + 60 })).toString('base64url')
  const sig = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${sig}`
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const body = await request.json() as { analytics?: boolean; marketing?: boolean; aiTraining?: boolean }

  try {
    const token = mintServiceToken(session.user.id)
    const res = await fetch(`${API_URL}/gdpr/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(await res.text())
    return NextResponse.json({ success: true })
  } catch {
    // Non-fatal — consent stored client-side in localStorage as fallback
    return NextResponse.json({ success: true, persisted: false })
  }
}
