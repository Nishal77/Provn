import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

export async function POST(request: Request) {
  const session = await getServerSession()
  const body = await request.json() as { analytics?: boolean; marketing?: boolean; aiTraining?: boolean }

  if (!session?.user?.email) {
    return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 })
  }

  // Forward to Node API — stores consent with timestamp in User table
  const apiUrl = process.env.INTERNAL_API_URL ?? 'http://localhost:4000'
  try {
    const res = await fetch(`${apiUrl}/gdpr/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env.INTERNAL_API_SECRET ?? '' },
      body: JSON.stringify({ email: session.user.email, ...body }),
    })
    if (!res.ok) throw new Error(await res.text())
    return NextResponse.json({ success: true })
  } catch {
    // Non-fatal — consent stored client-side in localStorage as fallback
    return NextResponse.json({ success: true, persisted: false })
  }
}
