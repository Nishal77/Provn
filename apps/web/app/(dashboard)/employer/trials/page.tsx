import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Trial } from '@attesta/shared'
import { TRIAL_STATUS_LABELS, TRIAL_STATUS_COLORS, TRIAL_DOMAIN_LABELS } from '@attesta/shared'

async function fetchEmployerTrials(token: string): Promise<Trial[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  const res = await fetch(`${apiUrl}/trials?role=employer`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.trials ?? []
}

export default async function EmployerTrialsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { SignJWT } = await import('jose')
  const user = session.user as { id: string; did?: string; kycTier?: string }
  const secret = process.env.JWT_ACCESS_SECRET!
  const token = await new SignJWT({ sub: user.id, did: user.did ?? null, tier: user.kycTier ?? 'T6_SELF' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('60s')
    .sign(new TextEncoder().encode(secret))

  const trials = await fetchEmployerTrials(token)
  const active = trials.filter(t => !['SCORED', 'CANCELLED', 'EXPIRED'].includes(t.status))
  const scored = trials.filter(t => t.status === 'SCORED')

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">WorkProof Trials</h1>
          <p className="text-sm text-gray-500 mt-1">Real-work sessions. Employer pays ${'{150-500}'}, candidate earns ${'{50-200}'}.</p>
        </div>
        <Link
          href="/employer/trials/new"
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700"
        >
          + New Trial
        </Link>
      </div>

      {active.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Active ({active.length})</h2>
          <TrialTable trials={active} />
        </section>
      )}

      {scored.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Completed ({scored.length})</h2>
          <TrialTable trials={scored} />
        </section>
      )}

      {trials.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg font-medium mb-2">No trials created yet</p>
          <p className="text-sm">Create a paid real-work trial to replace your interview process.</p>
        </div>
      )}
    </div>
  )
}

function TrialTable({ trials }: { trials: Trial[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-100">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wide">
          <tr>
            <th className="text-left px-4 py-3">Role</th>
            <th className="text-left px-4 py-3">Domain</th>
            <th className="text-left px-4 py-3">Status</th>
            <th className="text-right px-4 py-3">Score</th>
            <th className="text-right px-4 py-3">Cost</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {trials.map(t => {
            const avg = t.scores && t.scores.length > 0
              ? Math.round(t.scores.reduce((s, d) => s + d.score, 0) / t.scores.length)
              : null
            return (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{t.roleTitle}</td>
                <td className="px-4 py-3 text-gray-500">{TRIAL_DOMAIN_LABELS[t.domain]}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TRIAL_STATUS_COLORS[t.status]}`}>
                    {TRIAL_STATUS_LABELS[t.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-bold text-indigo-600">
                  {avg !== null ? avg : '—'}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">${t.compensationEmployerUsd}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/trials/${t.id}`} className="text-indigo-600 hover:underline text-xs font-semibold">
                    View →
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
