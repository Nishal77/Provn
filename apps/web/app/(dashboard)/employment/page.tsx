import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { EmploymentList } from '@/components/employment/employment-list'
import type { EmploymentRecord } from '@attesta/shared'

async function fetchEmploymentRecords(userId: string, did: string | null, tier: string): Promise<EmploymentRecord[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

  // Mint a short-lived service token server-side
  const { SignJWT } = await import('jose')
  const secret = process.env.JWT_ACCESS_SECRET
  if (!secret) return []

  const token = await new SignJWT({ sub: userId, did, tier })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('60s')
    .sign(new TextEncoder().encode(secret))

  const res = await fetch(`${apiUrl}/employment`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!res.ok) return []
  const json = await res.json()
  return json.data ?? []
}

export default async function EmploymentPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const user = session.user as { id: string; did?: string; kycTier?: string }
  const records = await fetchEmploymentRecords(user.id, user.did ?? null, user.kycTier ?? 'T6_SELF')

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employment Records</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Co-signed records are anchored on Polygon and earn a T2 Employer Verified badge (9/10 trust).
          </p>
        </div>
        <Link
          href="/employment/add"
          className="shrink-0 inline-flex items-center px-4 py-2 bg-indigo-600 text-white
                     text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          + Add Record
        </Link>
      </div>

      <EmploymentList records={records} />
    </div>
  )
}
