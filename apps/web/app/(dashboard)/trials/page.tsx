import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Trial } from '@attesta/shared'
import { TRIAL_STATUS_LABELS, TRIAL_STATUS_COLORS, TRIAL_DOMAIN_LABELS } from '@attesta/shared'

async function fetchTrials(token: string, role: string): Promise<Trial[]> {
  const apiUrl = process.env.INTERNAL_API_URL ?? 'http://localhost:4000'
  const res = await fetch(`${apiUrl}/trials?role=${role}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.trials ?? []
}

export default async function TrialsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { SignJWT } = await import('jose')
  const user = session.user as { id: string; did?: string; kycTier?: string }
  const secret = process.env.JWT_ACCESS_SECRET!
  const token = await new SignJWT({ sub: user.id, did: user.did ?? null, tier: user.kycTier ?? 'T6_SELF' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('60s')
    .sign(new TextEncoder().encode(secret))

  const trials = await fetchTrials(token, 'candidate')

  const active = trials.filter(t => !['SCORED', 'CANCELLED', 'EXPIRED'].includes(t.status))
  const past = trials.filter(t => ['SCORED', 'CANCELLED', 'EXPIRED'].includes(t.status))

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">WorkProof Trials</h1>
          <p className="text-sm text-gray-500 mt-1">Paid real-work sessions with employers</p>
        </div>
      </div>

      {active.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Active</h2>
          <div className="space-y-3">
            {active.map(t => <TrialCard key={t.id} trial={t} />)}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Completed</h2>
          <div className="space-y-3">
            {past.map(t => <TrialCard key={t.id} trial={t} />)}
          </div>
        </section>
      )}

      {trials.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg font-medium mb-2">No trials yet</p>
          <p className="text-sm">Employers will invite you to paid real-work sessions here.</p>
        </div>
      )}
    </div>
  )
}

function TrialCard({ trial }: { trial: Trial }) {
  const statusClass = TRIAL_STATUS_COLORS[trial.status]
  const avgScore = trial.scores && trial.scores.length > 0
    ? Math.round(trial.scores.reduce((s, d) => s + d.score, 0) / trial.scores.length)
    : null

  return (
    <Link href={`/trials/${trial.id}`}>
      <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors cursor-pointer">
        <div>
          <p className="font-semibold text-gray-900">{trial.roleTitle}</p>
          <p className="text-sm text-gray-400 mt-0.5">
            {TRIAL_DOMAIN_LABELS[trial.domain]} · {trial.durationMinutes}min · ${trial.compensationCandidateUsd}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {avgScore !== null && (
            <span className="text-lg font-extrabold text-indigo-600">{avgScore}</span>
          )}
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusClass}`}>
            {TRIAL_STATUS_LABELS[trial.status]}
          </span>
        </div>
      </div>
    </Link>
  )
}
