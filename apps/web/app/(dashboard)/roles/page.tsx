import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SignJWT } from 'jose'
import type { Role } from '@attesta/shared'
import { ROLE_DOMAIN_LABELS } from '@attesta/shared'

async function fetchRoles(token: string): Promise<(Role & { _count: { fitScores: number; hireOutcomes: number } })[]> {
  const apiUrl = process.env.INTERNAL_API_URL ?? 'http://localhost:4000'
  const res = await fetch(`${apiUrl}/roles`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.roles ?? []
}

const EXTRACTION_BADGES: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-500',
  EXTRACTING: 'bg-yellow-100 text-yellow-700',
  DONE: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-600',
}

export default async function RolesPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const user = session.user as { id: string; did?: string; kycTier?: string }
  const secret = process.env.JWT_ACCESS_SECRET!
  const token = await new SignJWT({ sub: user.id, did: user.did ?? null, tier: user.kycTier ?? 'T6_SELF' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('60s')
    .sign(new TextEncoder().encode(secret))

  const roles = await fetchRoles(token)
  const active = roles.filter(r => r.active)
  const inactive = roles.filter(r => !r.active)

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">RoleFit AI</h1>
          <p className="text-sm text-gray-500 mt-1">AI extracts real requirements from your codebase — not job description keywords</p>
        </div>
        <Link
          href="/roles/new"
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700"
        >
          + New Role
        </Link>
      </div>

      {/* Comp intel widget */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-8 flex items-center justify-between">
        <div>
          <p className="font-semibold text-indigo-800 text-sm">Compensation Intelligence</p>
          <p className="text-xs text-indigo-500 mt-0.5">Market P50 for Senior SWE (US): $180K · P75: $210K · P90: $240K</p>
        </div>
        <Link href="/market/compensation" className="text-xs font-semibold text-indigo-600 hover:underline">
          Full report →
        </Link>
      </div>

      {active.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Active Roles ({active.length})</h2>
          <div className="space-y-3">
            {active.map(r => <RoleCard key={r.id} role={r} />)}
          </div>
        </section>
      )}

      {inactive.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Closed</h2>
          <div className="space-y-3">
            {inactive.map(r => <RoleCard key={r.id} role={r} />)}
          </div>
        </section>
      )}

      {roles.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg font-medium mb-2">No roles yet</p>
          <p className="text-sm">Create a role and connect your GitHub repo — AI extracts actual requirements.</p>
          <Link href="/roles/new" className="mt-4 inline-block text-indigo-600 hover:underline text-sm font-semibold">
            Create first role →
          </Link>
        </div>
      )}
    </div>
  )
}

function RoleCard({ role }: { role: Role & { _count: { fitScores: number; hireOutcomes: number } } }) {
  return (
    <Link href={`/roles/${role.id}`}>
      <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors cursor-pointer">
        <div>
          <p className="font-semibold text-gray-900">{role.title}</p>
          <p className="text-sm text-gray-400 mt-0.5">
            {ROLE_DOMAIN_LABELS[role.domain]}
            {role.compensationMinUsd && ` · $${(role.compensationMinUsd / 1000).toFixed(0)}K–$${((role.compensationMaxUsd ?? role.compensationMinUsd * 1.3) / 1000).toFixed(0)}K`}
            {role.remote ? ' · Remote' : role.location ? ` · ${role.location}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {role._count.fitScores > 0 && (
            <span className="text-xs text-gray-500">{role._count.fitScores} matches</span>
          )}
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${EXTRACTION_BADGES[role.extractionStatus]}`}>
            {role.extractionStatus === 'DONE' ? 'Ready' : role.extractionStatus}
          </span>
          {role.blindMode && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Blind</span>
          )}
        </div>
      </div>
    </Link>
  )
}
