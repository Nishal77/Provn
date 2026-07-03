'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Trial } from '@attesta/shared'
import { TRIAL_STATUS_LABELS, TRIAL_STATUS_COLORS, TRIAL_DOMAIN_LABELS } from '@attesta/shared'

export default function TrialDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [trial, setTrial] = useState<Trial | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [launchUrl, setLaunchUrl] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/trials/${id}/score`)
    const data = await res.json()
    setTrial(data.trial ?? null)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleSign() {
    setActionLoading(true)
    setError('')
    const sig = `candidate-sig-${Date.now()}`
    const res = await fetch(`/api/trials/${id}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signature: sig }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Sign failed'); setActionLoading(false); return }
    setTrial(data.trial)
    setActionLoading(false)
  }

  async function handleLaunch() {
    setActionLoading(true)
    setError('')
    const res = await fetch(`/api/trials/${id}/launch`)
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Launch failed'); setActionLoading(false); return }
    setLaunchUrl(data.sandboxSessionUrl)
    await load()
    setActionLoading(false)
  }

  async function handleSubmit() {
    setActionLoading(true)
    setError('')
    const res = await fetch(`/api/trials/${id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keystrokeEntropyScore: 0.82, pasteEventCount: 0 }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Submit failed'); setActionLoading(false); return }
    setTrial(data.trial)
    setActionLoading(false)
  }

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-10 text-gray-400">Loading trial…</div>
  if (!trial) return <div className="max-w-2xl mx-auto px-4 py-10 text-red-500">Trial not found.</div>

  const statusClass = TRIAL_STATUS_COLORS[trial.status]
  const avgScore = trial.scores && trial.scores.length > 0
    ? Math.round(trial.scores.reduce((s, d) => s + d.score, 0) / trial.scores.length)
    : null

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <button onClick={() => router.back()} className="text-sm text-gray-400 hover:text-gray-600 mb-6">← Back</button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">{trial.roleTitle}</h1>
          <p className="text-sm text-gray-500 mt-1">{TRIAL_DOMAIN_LABELS[trial.domain]} · {trial.durationMinutes} min</p>
        </div>
        <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${statusClass}`}>
          {TRIAL_STATUS_LABELS[trial.status]}
        </span>
      </div>

      {trial.briefMarkdown && (
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-6">
          <p className="text-sm font-semibold text-gray-500 mb-2">Brief</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{trial.briefMarkdown}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-indigo-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-indigo-400 mb-1">Your earnings</p>
          <p className="text-2xl font-extrabold text-indigo-700">${trial.compensationCandidateUsd}</p>
        </div>
        {avgScore !== null && (
          <div className="bg-green-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-green-400 mb-1">Overall score</p>
            <p className="text-2xl font-extrabold text-green-700">{avgScore}/100</p>
          </div>
        )}
      </div>

      {/* Actions */}
      {trial.status === 'LEGAL_PENDING' && (
        <div className="border border-yellow-200 bg-yellow-50 rounded-xl p-4 mb-4">
          <p className="font-semibold text-yellow-800 mb-2">Sign the Work Product Trial Agreement (WPTA)</p>
          <p className="text-sm text-yellow-700 mb-4">
            Covers IP assignment, confidentiality, and payment. Valid in 50 US states, EU, and India.
          </p>
          <button
            onClick={handleSign}
            disabled={actionLoading}
            className="px-5 py-2 bg-yellow-600 text-white text-sm font-semibold rounded-lg hover:bg-yellow-700 disabled:opacity-50"
          >
            {actionLoading ? 'Signing…' : 'Sign Agreement'}
          </button>
        </div>
      )}

      {trial.status === 'READY' && (
        <button
          onClick={handleLaunch}
          disabled={actionLoading}
          className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 mb-4"
        >
          {actionLoading ? 'Launching sandbox…' : 'Launch Sandbox'}
        </button>
      )}

      {trial.status === 'IN_PROGRESS' && (
        <div className="space-y-3 mb-4">
          {launchUrl && (
            <a
              href={launchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 bg-purple-600 text-white font-semibold rounded-xl text-center hover:bg-purple-700"
            >
              Open Sandbox
            </a>
          )}
          <button
            onClick={handleSubmit}
            disabled={actionLoading}
            className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50"
          >
            {actionLoading ? 'Submitting…' : 'Submit Work'}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

      {/* Score breakdown */}
      {trial.scores && trial.scores.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">Score Breakdown</h2>
          <div className="space-y-2">
            {trial.scores.map(s => (
              <div key={s.dimension} className="flex items-center gap-3">
                <span className="w-28 text-sm text-gray-500 shrink-0">{s.dimension}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${s.score}%` }} />
                </div>
                <span className="w-10 text-sm font-bold text-gray-700 text-right">{s.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(trial.status === 'EVALUATING' || trial.status === 'SUBMITTED') && (
        <div className="mt-6 text-center text-gray-400">
          <p className="animate-pulse">AI evaluating your submission…</p>
          <p className="text-xs mt-1">Results typically ready in under 30 minutes.</p>
        </div>
      )}
    </div>
  )
}
