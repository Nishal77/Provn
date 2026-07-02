'use client'

// Public page — no ATTESTA account required.
// Employer receives an email, clicks the link, lands here to confirm or reject
// the employment record before it gets anchored on Polygon.

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type { CountersignPreview } from '@attesta/shared'
import { EMPLOYMENT_TYPE_LABELS } from '@attesta/shared'

type PageState = 'loading' | 'preview' | 'signed' | 'rejected' | 'expired' | 'error'

export default function CountersignPage() {
  const { token } = useParams() as { token: string }
  const [state, setState] = useState<PageState>('loading')
  const [record, setRecord] = useState<CountersignPreview | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/employment/countersign/${token}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setRecord(json.data)
          setState('preview')
        } else {
          setState(json.error?.code === 'TOKEN_EXPIRED' ? 'expired' : 'error')
        }
      })
      .catch(() => setState('error'))
  }, [token])

  async function act(action: 'sign' | 'reject') {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/employment/countersign/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (json.success) setState(action === 'sign' ? 'signed' : 'rejected')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Terminal states ──────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <Shell>
        <p className="text-gray-400 animate-pulse">Loading verification request…</p>
      </Shell>
    )
  }

  if (state === 'expired') {
    return (
      <Shell>
        <h2 className="text-lg font-semibold text-gray-800">Link expired</h2>
        <p className="text-gray-500 text-sm mt-2">
          This verification link has expired. Ask the candidate to resend the request.
        </p>
      </Shell>
    )
  }

  if (state === 'error') {
    return (
      <Shell>
        <h2 className="text-lg font-semibold text-red-600">Invalid link</h2>
        <p className="text-gray-500 text-sm mt-2">
          This link is invalid or has already been used.
        </p>
      </Shell>
    )
  }

  if (state === 'signed') {
    const name = record?.candidate?.profile?.fullName ?? 'The candidate'
    return (
      <Shell>
        <div className="text-green-500 text-4xl mb-4">✓</div>
        <h2 className="text-lg font-semibold text-gray-900">Verification confirmed</h2>
        <p className="text-gray-500 text-sm mt-2">
          {name}'s employment record is being anchored on the Polygon blockchain.
          They will receive a T2 Employer Verified badge on their ATTESTA profile within minutes.
        </p>
      </Shell>
    )
  }

  if (state === 'rejected') {
    return (
      <Shell>
        <h2 className="text-lg font-semibold text-gray-900">Record rejected</h2>
        <p className="text-gray-500 text-sm mt-2">
          The employment record has been rejected and the candidate has been notified.
        </p>
      </Shell>
    )
  }

  // ── Preview state ────────────────────────────────────────────────────────
  const r = record!
  const candidateName = r.candidate?.profile?.fullName ?? 'Unknown candidate'
  const avatarUrl     = r.candidate?.profile?.avatarUrl ?? null
  const start = new Date(r.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
  const end   = r.endDate
    ? new Date(r.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    : 'Present'
  const expiresFormatted = r.countersignTokenExpiresAt
    ? new Date(r.countersignTokenExpiresAt).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
      })
    : null

  return (
    <Shell>
      <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-2">
        Employment Verification Request
      </div>

      {/* Candidate info */}
      <div className="flex items-center gap-3 mb-4">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={candidateName} className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center
                          text-indigo-600 font-bold text-base">
            {candidateName.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <p className="font-semibold text-gray-900 text-sm">{candidateName}</p>
          <p className="text-xs text-gray-400">{r.employer.domain}</p>
        </div>
      </div>

      {/* Record details */}
      <div className="bg-gray-50 rounded-lg p-4 text-left mb-4">
        <p className="font-semibold text-gray-900 text-sm">{r.jobTitle}</p>
        {r.department && <p className="text-xs text-gray-500 mt-0.5">{r.department}</p>}
        <p className="text-xs text-gray-500 mt-1">
          {start} – {end} · {EMPLOYMENT_TYPE_LABELS[r.employmentType]}
        </p>
      </div>

      <p className="text-sm text-gray-600 mb-5">
        <strong>{candidateName}</strong> has listed this employment on their ATTESTA profile and
        requests your co-signature. Your signature creates a cryptographic record on the Polygon
        blockchain — no account required.
      </p>

      {/* CTA buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => act('sign')}
          disabled={submitting}
          className="flex-1 py-2.5 px-4 bg-indigo-600 text-white text-sm font-semibold rounded-lg
                     hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Confirming…' : 'Confirm & Sign'}
        </button>
        <button
          onClick={() => act('reject')}
          disabled={submitting}
          className="flex-1 py-2.5 px-4 border border-red-200 text-red-600 text-sm font-semibold
                     rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          Reject
        </button>
      </div>

      <p className="text-xs text-gray-400 mt-4">
        By clicking "Confirm & Sign" you attest that this employment information is accurate.
        This action is recorded on a public blockchain and cannot be undone.
      </p>

      {expiresFormatted && (
        <p className="text-xs text-amber-500 mt-2">Link expires {expiresFormatted}</p>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8
                      max-w-md w-full text-center">
        {children}
      </div>
    </div>
  )
}
