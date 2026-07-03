import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { SignJWT } from 'jose'
import Link from 'next/link'

interface CandidateSummary {
  did: string
  kycTier: string
  fullName: string | null
  avatarUrl: string | null
  headline: string | null
  trustScore: number
  skills: { skillSlug: string; skillLevel: number }[]
}

async function fetchCandidates(
  userId: string, did: string | null, tier: string,
  params: Record<string, string>
): Promise<CandidateSummary[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  const secret = process.env.JWT_ACCESS_SECRET
  if (!secret) return []
  const token = await new SignJWT({ sub: userId, did, tier })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('60s')
    .sign(new TextEncoder().encode(secret))
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`${apiUrl}/employer/candidates${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const json = await res.json()
  return json.data ?? []
}

const TIER_COLORS: Record<string, string> = {
  T1_GOVERNMENT: 'bg-purple-100 text-purple-700',
  T2_EMPLOYER: 'bg-blue-100 text-blue-700',
  T3_INSTITUTION: 'bg-indigo-100 text-indigo-700',
  T4_PEER: 'bg-green-100 text-green-700',
  T5_AI_INFERRED: 'bg-yellow-100 text-yellow-700',
  T6_SELF: 'bg-gray-100 text-gray-500',
}

const TIER_LABELS: Record<string, string> = {
  T1_GOVERNMENT: 'T1 Gov',
  T2_EMPLOYER: 'T2 Employer',
  T3_INSTITUTION: 'T3 Inst',
  T4_PEER: 'T4 Peer',
  T5_AI_INFERRED: 'T5 AI',
  T6_SELF: 'T6 Self',
}

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: { skill?: string; tier?: string; q?: string }
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const user = session.user as { id: string; did?: string; kycTier?: string }
  const filterParams: Record<string, string> = {}
  if (searchParams.skill) filterParams.skill = searchParams.skill
  if (searchParams.tier) filterParams.tier = searchParams.tier
  if (searchParams.q) filterParams.q = searchParams.q

  const candidates = await fetchCandidates(user.id, user.did ?? null, user.kycTier ?? 'T6_SELF', filterParams)

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Candidate Browser</h1>
          <p className="text-gray-500 text-sm mt-1">Browse verified profiles. Request ZK disclosures before revealing identities.</p>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 mb-6">
        <input
          name="q"
          defaultValue={searchParams.q}
          placeholder="Search skills, headline…"
          className="flex-1 min-w-48 border border-gray-200 rounded-lg px-3 py-2 text-sm
                     focus:ring-2 focus:ring-indigo-500 outline-none"
        />
        <select
          name="tier"
          defaultValue={searchParams.tier}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          <option value="">All tiers</option>
          <option value="T1_GOVERNMENT">T1 Government</option>
          <option value="T2_EMPLOYER">T2 Employer</option>
          <option value="T3_INSTITUTION">T3 Institution</option>
          <option value="T4_PEER">T4 Peer</option>
          <option value="T5_AI_INFERRED">T5 AI</option>
        </select>
        <input
          name="skill"
          defaultValue={searchParams.skill}
          placeholder="Skill (e.g. typescript)"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700"
        >
          Filter
        </button>
      </form>

      {candidates.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-gray-400 font-medium">No candidates found</p>
          <p className="text-gray-400 text-sm mt-1">Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {candidates.map(c => (
            <Link
              key={c.did}
              href={`/employer/candidates/${encodeURIComponent(c.did)}`}
              className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md
                         transition-shadow group"
            >
              <div className="flex items-center gap-3 mb-3">
                {c.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center
                                  text-indigo-600 font-bold">
                    {(c.fullName ?? '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{c.fullName ?? 'Anonymous'}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_COLORS[c.kycTier] ?? 'bg-gray-100'}`}>
                    {TIER_LABELS[c.kycTier] ?? c.kycTier}
                  </span>
                </div>
              </div>

              {c.headline && (
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{c.headline}</p>
              )}

              {c.skills.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {c.skills.slice(0, 4).map(s => (
                    <span key={s.skillSlug}
                      className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {s.skillSlug} {s.skillLevel}/10
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">Trust {c.trustScore}/100</span>
                <span className="text-xs text-indigo-600 font-medium group-hover:underline">View profile →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
