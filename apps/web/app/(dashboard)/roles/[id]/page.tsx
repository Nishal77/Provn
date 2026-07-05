'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Role, StoredFitScore } from '@attesta/shared'
import { ROLE_DOMAIN_LABELS, FIT_DIMENSION_WEIGHTS } from '@attesta/shared'

export default function RoleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [role, setRole] = useState<Role | null>(null)
  const [matches, setMatches] = useState<StoredFitScore[]>([])
  const [loading, setLoading] = useState(true)
  const [interestLoading, setInterestLoading] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [rRes, mRes] = await Promise.all([
      fetch(`/api/roles/${id}`),
      fetch(`/api/roles/${id}/matches`),
    ])
    const rData = await rRes.json()
    const mData = await mRes.json()
    setRole(rData.role ?? null)
    setMatches(mData.matches ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleInterest(candidateId: string) {
    setInterestLoading(candidateId)
    await fetch(`/api/roles/${id}/interest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateId }),
    })
    await load()
    setInterestLoading(null)
  }

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-10 text-gray-400">Loading…</div>
  if (!role) return <div className="max-w-4xl mx-auto px-4 py-10 text-red-500">Role not found.</div>

  const req = role.extractedRequirements as { languages?: string[]; frameworks?: string[]; tools?: string[]; seniorityLevel?: string; complexityScore?: number } | undefined

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <button onClick={() => router.back()} className="text-sm text-gray-400 hover:text-gray-600 mb-6">← Back</button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">{role.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {ROLE_DOMAIN_LABELS[role.domain]}
            {role.compensationMinUsd && ` · $${(role.compensationMinUsd / 1000).toFixed(0)}K–$${((role.compensationMaxUsd ?? role.compensationMinUsd * 1.3) / 1000).toFixed(0)}K`}
          </p>
        </div>
        <div className="flex gap-2">
          {role.blindMode && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">Blind Mode</span>}
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            role.extractionStatus === 'DONE' ? 'bg-green-100 text-green-700' :
            role.extractionStatus === 'EXTRACTING' ? 'bg-yellow-100 text-yellow-700' :
            'bg-gray-100 text-gray-500'
          }`}>
            {role.extractionStatus === 'DONE' ? 'Requirements extracted' : role.extractionStatus}
          </span>
        </div>
      </div>

      {req && (
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-8">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Extracted from codebase</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            {req.languages && req.languages.length > 0 && (
              <div>
                <p className="font-semibold text-gray-500 mb-1">Languages</p>
                {req.languages.map(l => <span key={l} className="block text-gray-700">{l}</span>)}
              </div>
            )}
            {req.frameworks && req.frameworks.length > 0 && (
              <div>
                <p className="font-semibold text-gray-500 mb-1">Frameworks</p>
                {req.frameworks.map(f => <span key={f} className="block text-gray-700">{f}</span>)}
              </div>
            )}
            {req.tools && req.tools.length > 0 && (
              <div>
                <p className="font-semibold text-gray-500 mb-1">Tools</p>
                {req.tools.map(t => <span key={t} className="block text-gray-700">{t}</span>)}
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-500 mb-1">Seniority</p>
              <span className="text-gray-700 capitalize">{req.seniorityLevel}</span>
              {req.complexityScore !== undefined && (
                <p className="text-xs text-gray-400 mt-1">Complexity: {req.complexityScore}/100</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">
          Top Matches {matches.length > 0 && <span className="text-gray-400 font-normal text-base">({matches.length})</span>}
        </h2>
        {role.extractionStatus === 'EXTRACTING' && (
          <p className="text-xs text-yellow-600 animate-pulse">Extracting requirements — match quality improves shortly</p>
        )}
      </div>

      {matches.length === 0 && (
        <div className="text-center py-12 text-gray-400 border border-dashed border-gray-200 rounded-xl">
          <p>No matches yet. {role.extractionStatus === 'PENDING' ? 'Add a GitHub repo URL to trigger extraction.' : 'AI matching in progress.'}</p>
        </div>
      )}

      <div className="space-y-3">
        {matches.map((m, i) => (
          <MatchCard key={m.id ?? i} match={m} onInterest={handleInterest} loading={interestLoading} />
        ))}
      </div>
    </div>
  )
}

function MatchCard({
  match,
  onInterest,
  loading,
}: {
  match: StoredFitScore & { candidate?: { id?: string; kycTier?: string; trustScore?: number; blindMode?: boolean } }
  onInterest: (id: string) => void
  loading: string | null
}) {
  const cand = match.candidate as { id?: string; kycTier?: string | null; trustScore?: number | null; blindMode?: boolean }
  const dims = Object.entries(FIT_DIMENSION_WEIGHTS) as [string, number][]

  return (
    <div className="border border-gray-100 rounded-xl p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-sm font-bold text-indigo-600">
            {match.overallScore}
          </div>
          <div>
            <p className="font-semibold text-gray-900">
              {cand.blindMode ? 'Candidate •••' : cand.id?.slice(0, 8)}
            </p>
            <p className="text-xs text-gray-400">
              {cand.kycTier ?? 'T6_SELF'}
              {cand.trustScore != null && ` · Trust ${Math.round(Number(cand.trustScore))}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {match.employerInterest
            ? <span className="text-xs text-green-600 font-semibold">Interest sent</span>
            : (
              <button
                onClick={() => cand.id && onInterest(cand.id)}
                disabled={loading === cand.id || !cand.id}
                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading === cand.id ? '…' : 'Express interest'}
              </button>
            )}
        </div>
      </div>

      {/* Dimension bars */}
      <div className="mt-3 grid grid-cols-5 gap-2">
        {dims.map(([dim]) => {
          const score = match[`${dim.toLowerCase()}Score` as keyof typeof match] as number
          return (
            <div key={dim}>
              <div className="flex justify-between mb-0.5">
                <span className="text-xs text-gray-400">{dim.slice(0, 3)}</span>
                <span className="text-xs font-semibold text-gray-700">{score}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full">
                <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${score}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
