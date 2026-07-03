import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { SignJWT } from 'jose'
import Link from 'next/link'
import type { ZKDisclosureRequest } from '@attesta/shared'
import { ZK_STATUS_LABELS, ZK_STATUS_COLORS, formatClaimLabel } from '@attesta/shared'

async function fetchDisclosures(userId: string, did: string | null, tier: string): Promise<ZKDisclosureRequest[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  const secret = process.env.JWT_ACCESS_SECRET
  if (!secret) return []
  const token = await new SignJWT({ sub: userId, did, tier })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('60s')
    .sign(new TextEncoder().encode(secret))
  const res = await fetch(`${apiUrl}/zk/requests`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const json = await res.json()
  return json.data ?? []
}

export default async function DisclosuresPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const user = session.user as { id: string; did?: string; kycTier?: string }
  const disclosures = await fetchDisclosures(user.id, user.did ?? null, user.kycTier ?? 'T6_SELF')
  const pending = disclosures.filter(d => d.status === 'PENDING_PROOF')
  const rest = disclosures.filter(d => d.status !== 'PENDING_PROOF')

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">ZK Disclosures</h1>
      <p className="text-gray-500 text-sm mb-6">
        Employers can request cryptographic proofs. Your actual values never leave your browser.
      </p>

      {disclosures.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-gray-400 font-medium">No disclosure requests yet</p>
          <p className="text-gray-400 text-sm mt-1">Employers can request ZK proofs from your profile.</p>
        </div>
      )}

      {pending.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Action required ({pending.length})
          </h2>
          <div className="space-y-3">
            {pending.map(d => (
              <DisclosureCard key={d.id} d={d} />
            ))}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">History</h2>
          <div className="space-y-3">
            {rest.map(d => (
              <DisclosureCard key={d.id} d={d} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function DisclosureCard({ d }: { d: ZKDisclosureRequest }) {
  const statusLabel = ZK_STATUS_LABELS[d.status]
  const statusClass = ZK_STATUS_COLORS[d.status]
  const claimLabel = formatClaimLabel(d.claimType, d.claimParams)
  const expires = d.status === 'PENDING_PROOF'
    ? new Date(d.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm">{claimLabel}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {d.claimType === 'SALARY_RANGE' ? 'Salary range proof' : 'Employment duration proof'}
          </p>
          {expires && (
            <p className="text-xs text-amber-500 mt-1">Expires {expires}</p>
          )}
        </div>
        <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${statusClass}`}>
          {statusLabel}
        </span>
      </div>

      {d.status === 'PENDING_PROOF' && (
        <div className="flex gap-2 mt-4">
          <Link
            href={`/disclosures/${d.id}/prove`}
            className="flex-1 text-center py-2 px-3 bg-indigo-600 text-white text-xs font-semibold
                       rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Generate proof
          </Link>
          <form action={`/api/zk/${d.id}/decline`} method="POST">
            <button
              type="submit"
              className="py-2 px-3 border border-gray-200 text-gray-500 text-xs font-semibold
                         rounded-lg hover:bg-gray-50 transition-colors"
            >
              Decline
            </button>
          </form>
        </div>
      )}

      {d.status === 'VERIFIED' && d.proofTxHash && (
        <a
          href={`https://polygonscan.com/tx/${d.proofTxHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs text-indigo-600 hover:text-indigo-700 mt-3"
        >
          View on Polygon ↗
        </a>
      )}
    </div>
  )
}
