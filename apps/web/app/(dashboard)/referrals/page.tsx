'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Referral } from '@attesta/shared'
import { REFERRAL_STATUS_LABELS, REFERRAL_STATUS_COLORS, TRANCHE_PERCENTAGES } from '@attesta/shared'

export default function ReferralsPage() {
  const [tab, setTab] = useState<'sent' | 'received'>('sent')
  const [referrals, setReferrals] = useState<(Referral & { role: { title: string } })[]>([])
  const [loading, setLoading] = useState(true)

  async function load(role: 'sent' | 'received') {
    setLoading(true)
    const res = await fetch(`/api/referrals?role=${role === 'sent' ? 'referrer' : 'candidate'}`)
    const data = await res.json()
    setReferrals(data.referrals ?? [])
    setLoading(false)
  }

  useEffect(() => { load(tab) }, [tab])

  const totalEarned = referrals
    .filter(r => ['TRANCHE1_RELEASED', 'TRANCHE2_RELEASED', 'TRANCHE3_RELEASED', 'COMPLETED'].includes(r.status))
    .reduce((s, r) => s + (r.bountyTotalUsd ?? 0), 0)

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">TrustChain Referrals</h1>
          <p className="text-sm text-gray-500 mt-1">Earn $1K–$15K per hire. Paid in 3 tranches.</p>
        </div>
        <Link href="/bounties" className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700">
          Browse Bounties →
        </Link>
      </div>

      {/* Talent Scout stats */}
      {tab === 'sent' && totalEarned > 0 && (
        <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="font-semibold text-green-800">Talent Scout earnings</p>
            <p className="text-xs text-green-600 mt-0.5">Top scouts earn $20K–$80K/year</p>
          </div>
          <p className="text-2xl font-extrabold text-green-700">${totalEarned.toLocaleString()}</p>
        </div>
      )}

      {/* Tranche info */}
      <div className="flex gap-2 mb-6">
        {TRANCHE_PERCENTAGES.map((pct, i) => (
          <div key={i} className="flex-1 bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-center">
            <p className="text-lg font-extrabold text-indigo-700">{pct}%</p>
            <p className="text-xs text-indigo-400">{i === 0 ? 'At hire' : i === 1 ? '90 days' : '180 days'}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        {(['sent', 'received'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {t === 'sent' ? 'Referrals sent' : 'Referrals received'}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading…</p>}

      {!loading && referrals.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="font-medium">{tab === 'sent' ? 'No referrals sent yet' : 'No referrals received'}</p>
          {tab === 'sent' && (
            <p className="text-sm mt-1">Browse the bounty board and refer trusted contacts.</p>
          )}
        </div>
      )}

      <div className="space-y-3">
        {referrals.map(r => (
          <div key={r.id} className="border border-gray-100 rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">{r.role?.title ?? 'Unknown role'}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(r.createdAt).toLocaleDateString()}
                  {r.bountyTotalUsd && ` · $${r.bountyTotalUsd.toLocaleString()} bounty`}
                </p>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${REFERRAL_STATUS_COLORS[r.status]}`}>
                {REFERRAL_STATUS_LABELS[r.status]}
              </span>
            </div>
            {r.note && <p className="text-sm text-gray-500 mt-2 italic">&quot;{r.note}&quot;</p>}

            {/* Tranche timeline */}
            {['HIRED', 'TRANCHE1_RELEASED', 'TRANCHE2_RELEASED', 'TRANCHE3_RELEASED', 'COMPLETED'].includes(r.status) && (
              <div className="flex gap-2 mt-3">
                {[r.tranche1PaidAt, r.tranche2PaidAt, r.tranche3PaidAt].map((paid, i) => (
                  <div
                    key={i}
                    className={`flex-1 h-1.5 rounded-full ${paid ? 'bg-green-500' : 'bg-gray-200'}`}
                    title={paid ? `Tranche ${i + 1} paid` : `Tranche ${i + 1} pending`}
                  />
                ))}
              </div>
            )}

            {r.contractAddress && (
              <p className="text-xs text-gray-300 mt-2 font-mono truncate">{r.contractAddress}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
