import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'

async function fetchProfile(did: string): Promise<Record<string, unknown> | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  const res = await fetch(`${apiUrl}/protocol/profile/${encodeURIComponent(did)}`, { cache: 'no-store' })
  if (!res.ok) return null
  return res.json()
}

export default async function CandidateDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const did = decodeURIComponent(params.id)
  const profile = await fetchProfile(did) as {
    did: string; kycTier: string; fullName: string; avatarUrl: string | null
    headline: string | null; trustScore: number; completenessScore: number
    skills: { skillSlug: string; skillLevel: number; chainTxHash: string }[]
    employment: { jobTitle: string; employer: { name: string; domain: string }; chainTxHash: string }[]
  } | null

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <p className="text-gray-400">Profile not found or private.</p>
        <Link href="/employer/candidates" className="text-indigo-600 text-sm mt-4 inline-block hover:underline">
          ← Back to candidates
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <Link href="/employer/candidates" className="text-sm text-gray-400 hover:text-gray-600 mb-6 inline-block">
        ← Back to candidates
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-5 shadow-sm">
        <div className="flex items-center gap-4 mb-4">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center
                            text-indigo-600 font-bold text-2xl">
              {(profile.fullName ?? '?').charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-gray-900">{profile.fullName ?? 'Anonymous'}</h1>
            {profile.headline && <p className="text-gray-500 text-sm mt-0.5">{profile.headline}</p>}
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium mt-1 inline-block">
              {profile.kycTier.replace('_', ' ')}
            </span>
          </div>
        </div>
        <div className="flex gap-6 text-sm">
          <div>
            <p className="text-gray-400 text-xs">Trust Score</p>
            <p className="font-bold text-gray-900 text-lg">{profile.trustScore}/100</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Profile Complete</p>
            <p className="font-bold text-gray-900 text-lg">{profile.completenessScore}%</p>
          </div>
        </div>
      </div>

      {/* Skills */}
      {profile.skills.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-3">Verified Skills</h2>
          <div className="space-y-2">
            {profile.skills.map(s => (
              <div key={s.skillSlug} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800 capitalize">{s.skillSlug}</span>
                  <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                    {s.skillLevel}/10
                  </span>
                </div>
                <a
                  href={`https://polygonscan.com/tx/${s.chainTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-500 hover:underline"
                >
                  Verified ↗
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Employment */}
      {profile.employment.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-3">Verified Employment</h2>
          <div className="space-y-2">
            {profile.employment.map((e, i) => (
              <div key={i} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">{e.jobTitle}</p>
                  <p className="text-xs text-gray-400">{e.employer.name}</p>
                </div>
                <a
                  href={`https://polygonscan.com/tx/${e.chainTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-500 hover:underline"
                >
                  Verified ↗
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request ZK Disclosure */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
        <h2 className="font-semibold text-indigo-900 mb-1">Request ZK Disclosure</h2>
        <p className="text-indigo-700 text-sm mb-4">
          Ask the candidate to cryptographically prove salary range or tenure — without revealing the actual values.
        </p>
        <div className="flex gap-3">
          <Link
            href={`/employer/disclosures/new?candidateId=${encodeURIComponent(did)}&claim=SALARY_RANGE`}
            className="flex-1 text-center py-2 px-3 bg-indigo-600 text-white text-xs font-semibold
                       rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Request salary proof
          </Link>
          <Link
            href={`/employer/disclosures/new?candidateId=${encodeURIComponent(did)}&claim=EMPLOYMENT_DURATION`}
            className="flex-1 text-center py-2 px-3 border border-indigo-300 text-indigo-700 text-xs
                       font-semibold rounded-lg hover:bg-indigo-100 transition-colors"
          >
            Request tenure proof
          </Link>
        </div>
      </div>
    </div>
  )
}
