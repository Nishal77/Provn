import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { SignJWT } from 'jose'

interface PendingRecord {
  id: string
  jobTitle: string
  department: string | null
  startDate: string
  endDate: string | null
  employmentType: string
  countersignTokenExpiresAt: string | null
  candidate: {
    did: string | null
    profile: { fullName: string | null; avatarUrl: string | null } | null
  }
}

async function fetchPendingRecords(userId: string, did: string | null, tier: string): Promise<PendingRecord[]> {
  const apiUrl = process.env.INTERNAL_API_URL ?? 'http://localhost:4000'
  const secret = process.env.JWT_ACCESS_SECRET
  if (!secret) return []

  const token = await new SignJWT({ sub: userId, did, tier })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('60s')
    .sign(new TextEncoder().encode(secret))

  const res = await fetch(`${apiUrl}/employment/pending-review`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!res.ok) return []
  const json = await res.json()
  return json.data ?? []
}

export default async function EmployerEmploymentPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const user = session.user as { id: string; did?: string; kycTier?: string }
  const records = await fetchPendingRecords(user.id, user.did ?? null, user.kycTier ?? 'T6_SELF')

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Pending Verifications</h1>
      <p className="text-gray-500 text-sm mb-6">
        Candidates who listed your organisation as their employer. Check your billing email
        for the co-sign link, or ask the candidate to resend.
      </p>

      {records.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-gray-400 font-medium">No pending verification requests</p>
          <p className="text-gray-400 text-sm mt-1">
            When candidates request verification, they'll appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map(r => {
            const start = new Date(r.startDate).toLocaleDateString('en-US', {
              year: 'numeric', month: 'short',
            })
            const end = r.endDate
              ? new Date(r.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
              : 'Present'
            const candidateName = r.candidate?.profile?.fullName ?? 'Unknown candidate'
            const expires = r.countersignTokenExpiresAt
              ? new Date(r.countersignTokenExpiresAt).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric',
                })
              : null

            return (
              <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{candidateName}</p>
                    <p className="text-sm text-gray-600 mt-0.5">
                      {r.jobTitle}
                      {r.department ? ` · ${r.department}` : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{start} – {end}</p>
                    {expires && (
                      <p className="text-xs text-amber-500 mt-1">Sign link expires {expires}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs bg-yellow-100 text-yellow-800 px-2.5 py-1
                                   rounded-full font-medium whitespace-nowrap">
                    Awaiting signature
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  Check your billing inbox for the co-sign email from ATTESTA, or ask {candidateName} to resend.
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
