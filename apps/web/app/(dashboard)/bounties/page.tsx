import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SignJWT } from 'jose'
import type { BountyListing } from '@attesta/shared'
import { ROLE_DOMAIN_LABELS } from '@attesta/shared'
import type { RoleDomain } from '@attesta/shared'

async function fetchBounties(token: string, domain?: string): Promise<(BountyListing & { role: { id: string; title: string; domain: string; remote: boolean } })[]> {
  const apiUrl = process.env.INTERNAL_API_URL ?? 'http://localhost:4000'
  const params = new URLSearchParams()
  if (domain) params.set('domain', domain)
  const res = await fetch(`${apiUrl}/bounties?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.bounties ?? []
}

export default async function BountiesPage({ searchParams }: { searchParams: { domain?: string } }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const user = session.user as { id: string; did?: string; kycTier?: string }
  const secret = process.env.JWT_ACCESS_SECRET!
  const token = await new SignJWT({ sub: user.id, did: user.did ?? null, tier: user.kycTier ?? 'T6_SELF' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('60s')
    .sign(new TextEncoder().encode(secret))

  const bounties = await fetchBounties(token, searchParams.domain)

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Bounty Board</h1>
          <p className="text-sm text-gray-500 mt-1">Refer trusted contacts. Earn $1K–$15K per placement.</p>
        </div>
        <Link href="/referrals" className="text-sm text-indigo-600 font-semibold hover:underline">
          My referrals →
        </Link>
      </div>

      {/* Domain filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {([undefined, 'CODE', 'DESIGN', 'DATA', 'MANAGEMENT'] as (string | undefined)[]).map(d => (
          <Link
            key={d ?? 'all'}
            href={d ? `/bounties?domain=${d}` : '/bounties'}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              searchParams.domain === d || (!searchParams.domain && !d)
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            {d ? ROLE_DOMAIN_LABELS[d as RoleDomain] : 'All'}
          </Link>
        ))}
      </div>

      {bounties.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg font-medium">No open bounties</p>
          <p className="text-sm mt-1">Check back soon — employers post new bounties regularly.</p>
        </div>
      )}

      <div className="space-y-4">
        {bounties.map(b => (
          <div key={b.id} className="border border-gray-100 rounded-xl p-5 hover:border-indigo-200 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-gray-900">{b.role?.title ?? 'Unknown role'}</p>
                <p className="text-sm text-gray-400 mt-0.5">
                  {ROLE_DOMAIN_LABELS[b.domain as RoleDomain] ?? b.domain}
                  {b.role?.remote ? ' · Remote' : ''}
                  {b.expiresAt && ` · Expires ${new Date(b.expiresAt).toLocaleDateString()}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-extrabold text-green-700">
                  ${b.totalBountyUsd.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400">bounty</p>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <div className="flex-1 flex gap-1">
                {[33, 33, 34].map((pct, i) => (
                  <div key={i} className="flex-1 text-center">
                    <p className="text-sm font-bold text-gray-700">${Math.round(b.totalBountyUsd * pct / 100).toLocaleString()}</p>
                    <p className="text-xs text-gray-400">{i === 0 ? 'At hire' : i === 1 ? '90d' : '180d'}</p>
                  </div>
                ))}
              </div>
              <Link
                href={`/roles/${b.roleId}`}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700"
              >
                Refer someone →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
