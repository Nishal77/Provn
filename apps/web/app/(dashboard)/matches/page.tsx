import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SignJWT } from 'jose'

interface MatchRow {
  fitScoreId: string
  overallScore: number
  capabilityScore: number
  cultureScore: number
  growthScore: number
  compScore: number
  careerScore: number
  employerInterest: boolean
  candidateInterest: boolean
  revealedAt?: string
  role: { id: string; title: string; domain: string; compensationMinUsd?: number; compensationMaxUsd?: number; remote: boolean }
}

async function fetchCandidateMatches(token: string): Promise<MatchRow[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  const res = await fetch(`${apiUrl}/matches`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.matches ?? []
}

export default async function MatchesPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const user = session.user as { id: string; did?: string; kycTier?: string }
  const secret = process.env.JWT_ACCESS_SECRET!
  const token = await new SignJWT({ sub: user.id, did: user.did ?? null, tier: user.kycTier ?? 'T6_SELF' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('60s')
    .sign(new TextEncoder().encode(secret))

  const matches = await fetchCandidateMatches(token)

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900">RoleFit Matches</h1>
        <p className="text-sm text-gray-500 mt-1">Roles matched to your verified skills — not keywords</p>
      </div>

      {matches.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg font-medium mb-2">No matches yet</p>
          <p className="text-sm">Add more verified skills to improve your FitScore across active roles.</p>
          <Link href="/skills" className="mt-4 inline-block text-indigo-600 hover:underline text-sm font-semibold">
            Add skills →
          </Link>
        </div>
      )}

      <div className="space-y-4">
        {matches.map(m => (
          <div key={m.fitScoreId} className="border border-gray-100 rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="font-bold text-gray-900">{m.role.title}</p>
                <p className="text-sm text-gray-400 mt-0.5">
                  {m.role.domain}
                  {m.role.compensationMinUsd && ` · $${(m.role.compensationMinUsd / 1000).toFixed(0)}K+`}
                  {m.role.remote ? ' · Remote' : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-extrabold text-indigo-600">{m.overallScore}</p>
                <p className="text-xs text-gray-400">FitScore</p>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2 mb-4">
              {[
                ['CAP', m.capabilityScore],
                ['CUL', m.cultureScore],
                ['GRO', m.growthScore],
                ['COM', m.compScore],
                ['CAR', m.careerScore],
              ].map(([label, score]) => (
                <div key={label as string}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-gray-400">{label}</span>
                    <span className="text-xs font-semibold text-gray-700">{score}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full">
                    <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${score}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {m.employerInterest && !m.revealedAt && (
                <span className="text-xs bg-yellow-100 text-yellow-700 font-semibold px-2.5 py-1 rounded-full">
                  Employer interested — reveal identity?
                </span>
              )}
              {m.revealedAt && (
                <span className="text-xs bg-green-100 text-green-700 font-semibold px-2.5 py-1 rounded-full">
                  Identities revealed
                </span>
              )}
              {!m.employerInterest && (
                <span className="text-xs text-gray-400">Awaiting employer interest</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
