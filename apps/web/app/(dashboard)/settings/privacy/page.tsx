'use client'

import { useState, useEffect } from 'react'

interface ConsentPreferences {
  analytics: boolean
  marketing: boolean
  aiTraining: boolean
}

const CONSENT_KEY = 'attesta_consent_v1'

function loadConsent(): ConsentPreferences {
  if (typeof window === 'undefined') return { analytics: false, marketing: false, aiTraining: false }
  try {
    return JSON.parse(localStorage.getItem(CONSENT_KEY) ?? 'null') ?? { analytics: false, marketing: false, aiTraining: false }
  } catch {
    return { analytics: false, marketing: false, aiTraining: false }
  }
}

export default function PrivacyPage() {
  const [exporting, setExporting] = useState(false)
  const [requestingErasure, setRequestingErasure] = useState(false)
  const [consent, setConsent] = useState<ConsentPreferences>({ analytics: false, marketing: false, aiTraining: false })
  const [consentSaved, setConsentSaved] = useState(false)

  useEffect(() => {
    setConsent(loadConsent())
  }, [])

  function updateConsent(key: keyof ConsentPreferences, value: boolean) {
    const next = { ...consent, [key]: value }
    setConsent(next)
    localStorage.setItem(CONSENT_KEY, JSON.stringify(next))
    // Sync to backend
    fetch('/api/gdpr/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    }).catch(() => null)
    setConsentSaved(true)
    setTimeout(() => setConsentSaved(false), 2000)
  }
  const [otp, setOtp] = useState('')
  const [confirmingErasure, setConfirmingErasure] = useState(false)
  const [step, setStep] = useState<'idle' | 'otp' | 'done'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch('/api/gdpr/export')
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'attesta-data-export.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Export failed. Try again.')
    } finally {
      setExporting(false)
    }
  }

  async function requestErasure() {
    setRequestingErasure(true)
    setError(null)
    try {
      const res = await fetch('/api/gdpr/erasure/request', { method: 'POST' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.code)
      setStep('otp')
      setMessage('Confirmation code sent to your email.')
    } catch {
      setError('Failed to send code. Try again.')
    } finally {
      setRequestingErasure(false)
    }
  }

  async function confirmErasure() {
    if (!otp.trim()) { setError('Enter the code'); return }
    setConfirmingErasure(true)
    setError(null)
    try {
      const res = await fetch('/api/gdpr/erasure/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.code)
      setStep('done')
      setMessage(json.message)
    } catch (err) {
      setError(err instanceof Error && err.message === 'INVALID_OTP'
        ? 'Invalid code. Check your email.'
        : 'Erasure failed.')
    } finally {
      setConfirmingErasure(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Privacy & Data</h1>
      <p className="text-gray-500 text-sm mb-8">Your rights under GDPR Article 20 and 17.</p>

      {/* Data export */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5 mb-5 shadow-sm">
        <h2 className="font-semibold text-gray-900 mb-1">Export your data</h2>
        <p className="text-gray-500 text-sm mb-4">
          Download everything ATTESTA holds about you as JSON (GDPR Article 20 — data portability).
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg
                     hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {exporting ? 'Preparing…' : 'Download export'}
        </button>
      </section>

      {/* Erasure */}
      <section className="bg-white border border-red-200 rounded-2xl p-5 shadow-sm">
        <h2 className="font-semibold text-red-700 mb-1">Delete your account</h2>
        <p className="text-gray-500 text-sm mb-4">
          Permanently erase all your personal data (GDPR Article 17). On-chain cryptographic
          hashes remain — they contain no personal information and are immutable by design.
          <strong className="text-gray-700"> This cannot be undone.</strong>
        </p>

        {step === 'idle' && (
          <button
            onClick={requestErasure}
            disabled={requestingErasure}
            className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg
                       hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {requestingErasure ? 'Sending code…' : 'Request account deletion'}
          </button>
        )}

        {step === 'otp' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">{message}</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                placeholder="6-digit code"
                maxLength={6}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-36
                           focus:ring-2 focus:ring-red-500 outline-none"
              />
              <button
                onClick={confirmErasure}
                disabled={confirmingErasure}
                className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg
                           hover:bg-red-700 disabled:opacity-50"
              >
                {confirmingErasure ? 'Deleting…' : 'Confirm deletion'}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{message}</p>
        )}

        {error && (
          <p className="text-sm text-red-600 mt-3">{error}</p>
        )}
      </section>

      {/* GDPR Consent Management */}
      <section className="space-y-4 border border-gray-200 rounded-lg p-6">
        <div>
          <h2 className="text-lg font-semibold">Consent Preferences</h2>
          <p className="text-sm text-gray-500 mt-1">
            Control how ATTESTA uses your data. Required processing is always active.
          </p>
          {consentSaved && <p className="text-sm text-green-600 mt-1">Preferences saved.</p>}
        </div>
        <div className="space-y-4">
          {/* Analytics */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded"
              checked={consent.analytics}
              onChange={e => updateConsent('analytics', e.target.checked)}
            />
            <div>
              <p className="text-sm font-medium">Analytics</p>
              <p className="text-xs text-gray-500">Helps us improve the platform (Datadog, aggregated telemetry). No personal data sold.</p>
            </div>
          </label>
          {/* Marketing */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded"
              checked={consent.marketing}
              onChange={e => updateConsent('marketing', e.target.checked)}
            />
            <div>
              <p className="text-sm font-medium">Marketing Communications</p>
              <p className="text-xs text-gray-500">Product updates, career insights, and featured opportunities via email.</p>
            </div>
          </label>
          {/* AI Training */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded"
              checked={consent.aiTraining}
              onChange={e => updateConsent('aiTraining', e.target.checked)}
            />
            <div>
              <p className="text-sm font-medium">AI Model Improvement</p>
              <p className="text-xs text-gray-500">Anonymized skill evaluation data helps train better AI models. No PII included.</p>
            </div>
          </label>
        </div>
      </section>
    </div>
  )
}
