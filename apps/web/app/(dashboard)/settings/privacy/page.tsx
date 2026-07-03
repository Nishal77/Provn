'use client'

import { useState } from 'react'

export default function PrivacyPage() {
  const [exporting, setExporting] = useState(false)
  const [requestingErasure, setRequestingErasure] = useState(false)
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
    </div>
  )
}
