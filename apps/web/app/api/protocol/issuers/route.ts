import { NextRequest, NextResponse } from 'next/server'
import { mintServiceToken } from '@/lib/service-token'

const API_URL = process.env.INTERNAL_API_URL ?? 'http://localhost:4000'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const qs = new URLSearchParams()
  if (searchParams.get('countryCode')) qs.set('countryCode', searchParams.get('countryCode')!)
  if (searchParams.get('status')) qs.set('status', searchParams.get('status')!)

  const res = await fetch(`${API_URL}/protocol/issuers?${qs}`, {
    headers: { Authorization: `Bearer ${await mintServiceToken()}` },
    next: { revalidate: 300 },
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
