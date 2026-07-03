'use client'

/**
 * OpenRep DAO Governance — web page
 * Shows active proposals, vote breakdown, quorum meter.
 * Connects to smart contract via Privy + viem (read-only in this scaffold).
 */
import { useState } from 'react'

interface Proposal {
  id: number
  title: string
  description: string
  state: 'Active' | 'Succeeded' | 'Defeated' | 'Queued' | 'Executed' | 'Pending'
  forVotes: number
  againstVotes: number
  endAt: string
  proposer: string
}

const MOCK_PROPOSALS: Proposal[] = [
  {
    id: 1,
    title: 'ORP-1: Add MIT as tier-1 university issuer',
    description: 'Proposal to onboard MIT (mit.edu) as a verified OpenRep issuer at T3_INSTITUTION tier. MIT has completed domain verification and legal review.',
    state: 'Active',
    forVotes: 2_400_000,
    againstVotes: 120_000,
    endAt: '2026-07-10T00:00:00Z',
    proposer: '0xabc...1234',
  },
  {
    id: 2,
    title: 'ORP-2: Reduce OpenRep API fee to $0.005/read',
    description: 'Reduce per-attestation read fee from $0.01 to $0.005 to drive ecosystem adoption. Treasury modeling shows break-even at 2M reads/day.',
    state: 'Succeeded',
    forVotes: 5_100_000,
    againstVotes: 800_000,
    endAt: '2026-07-01T00:00:00Z',
    proposer: '0xdef...5678',
  },
  {
    id: 3,
    title: 'ORP-3: Add Stanford and UC Berkeley as issuers',
    description: 'Batch onboarding of Stanford (stanford.edu) and UC Berkeley (berkeley.edu). Both have completed verification.',
    state: 'Pending',
    forVotes: 0,
    againstVotes: 0,
    endAt: '2026-07-17T00:00:00Z',
    proposer: '0x111...aaaa',
  },
]

const STATE_STYLES: Record<string, string> = {
  Active:    'bg-green-100 text-green-700',
  Succeeded: 'bg-blue-100 text-blue-700',
  Defeated:  'bg-red-100 text-red-700',
  Queued:    'bg-yellow-100 text-yellow-700',
  Executed:  'bg-gray-100 text-gray-600',
  Pending:   'bg-purple-100 text-purple-700',
}

function QuorumBar({ forVotes, againstVotes, quorumTarget = 4_000_000 }: { forVotes: number; againstVotes: number; quorumTarget?: number }) {
  const total = forVotes + againstVotes || 1
  const forPct = Math.round((forVotes / total) * 100)
  const quorumPct = Math.min(100, Math.round((forVotes / quorumTarget) * 100))

  return (
    <div className="space-y-2 mt-3">
      <div className="flex justify-between text-xs text-gray-500">
        <span>FOR {forVotes.toLocaleString()} REP ({forPct}%)</span>
        <span>AGAINST {againstVotes.toLocaleString()} REP</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${forPct}%` }} />
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <div className="flex-1 h-1.5 bg-gray-100 rounded">
          <div className="h-full bg-green-400 rounded" style={{ width: `${quorumPct}%` }} />
        </div>
        <span>{quorumPct}% of quorum (4% supply needed)</span>
      </div>
    </div>
  )
}

export default function GovernancePage() {
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all' ? MOCK_PROPOSALS : MOCK_PROPOSALS.filter(p => p.state === filter)

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">OpenRep DAO Governance</h1>
        <p className="text-sm text-gray-500 mt-1">
          Community governance for the OpenRep protocol. REP token holders vote on protocol changes, issuer onboarding, and fee adjustments.
        </p>
        <a href="https://dao.openrep.io" target="_blank" rel="noopener" className="text-xs text-indigo-600 mt-1 block hover:underline">
          dao.openrep.io →
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Active proposals', value: MOCK_PROPOSALS.filter(p => p.state === 'Active').length },
          { label: 'Total proposals', value: MOCK_PROPOSALS.length },
          { label: 'Quorum', value: '4% supply' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-xl font-black text-indigo-600">{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'Active', 'Succeeded', 'Pending', 'Defeated'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${filter === f ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      {/* Proposals */}
      {filtered.map(p => (
        <div key={p.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-gray-400">ORP-{p.id}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATE_STYLES[p.state]}`}>{p.state}</span>
              </div>
              <h2 className="font-bold text-gray-900">{p.title}</h2>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">{p.description}</p>
            </div>
          </div>

          <QuorumBar forVotes={p.forVotes} againstVotes={p.againstVotes} />

          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-gray-400">
              Ends {new Date(p.endAt).toLocaleDateString()} · Proposer {p.proposer}
            </span>
            {p.state === 'Active' && (
              <div className="flex gap-2">
                <button className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700">
                  Vote FOR
                </button>
                <button className="px-4 py-1.5 bg-white border border-red-200 text-red-600 text-xs font-bold rounded-lg hover:border-red-400">
                  Vote AGAINST
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
