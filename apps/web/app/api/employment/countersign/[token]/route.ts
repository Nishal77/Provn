// Public proxy — no auth session required.
// The countersign endpoint is open because the token itself proves identity.

import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const res = await fetch(`${API_URL}/employment/countersign/${params.token}`)
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const body = await req.json() as { action: 'sign' | 'reject' }
  const endpoint = body.action === 'sign' ? 'sign' : 'reject'

  const res = await fetch(`${API_URL}/employment/countersign/${params.token}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
