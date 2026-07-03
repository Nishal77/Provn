'use client'

// Client-side ZK proof generation using SnarkJS.
// Private inputs (actual salary / tenure) NEVER leave this browser tab.
// Only the Groth16 proof + public signals travel to the server.

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { ZKDisclosureRequest, SalaryRangeParams, EmploymentDurationParams } from '@attesta/shared'
import { formatClaimLabel } from '@attesta/shared'

type PageState = 'loading' | 'form' | 'proving' | 'submitting' | 'done' | 'error'

export default function ProvePage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [state, setState] = useState<PageState>('loading')
  const [request, setRequest] = useState<ZKDisclosureRequest | null>(null)
  const [privateValue, setPrivateValue] = useState('')
  const [privateValue2, setPrivateValue2] = useState('') // for salary: max of their actual range
  const [error, setError] = useState<string | null>(null)
  const [verified, setVerified] = useState(false)

  useEffect(() => {
    fetch(`/api/zk/requests/${id}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) { setRequest(json.data); setState('form') }
        else setState('error')
      })
      .catch(() => setState('error'))
  }, [id])

  async function handleProve(e: React.FormEvent) {
    e.preventDefault()
    if (!request) return
    setError(null)
    setState('proving')

    try {
      // ── Load SnarkJS (CDN — circuit WASM + zkey from /public/circuits/) ──
      // @ts-ignore — snarkjs loaded via <Script> tag or dynamic import
      const snarkjs = (window as unknown as { snarkjs?: { groth16: { fullProve: Function } } }).snarkjs

      if (!snarkjs) {
        throw new Error('SnarkJS not loaded. Ensure /public/circuits/ files are present.')
      }

      const issalary = request.claimType === 'SALARY_RANGE'
      const circuitName = issalary ? 'salaryRange' : 'employmentDuration'
      const wasmPath = `/circuits/${circuitName}.wasm`
      const zkeyPath = `/circuits/${circuitName}_final.zkey`

      let input: Record<string, number>
      if (issalary) {
        const params = request.claimParams as SalaryRangeParams
        const actual = parseInt(privateValue, 10)
        if (isNaN(actual) || actual < 0) throw new Error('Enter a valid salary')
        input = {
          actualSalary: actual,
          minSalary: params.minSalary,
          maxSalary: params.maxSalary,
        }
      } else {
        const params = request.claimParams as EmploymentDurationParams
        const actual = parseInt(privateValue, 10)
        if (isNaN(actual) || actual < 0) throw new Error('Enter a valid number of months')
        input = { actualMonths: actual, minMonths: params.minMonths }
      }

      // ── Generate proof client-side ────────────────────────────────────
      // Private inputs go INTO snarkjs.groth16.fullProve and never leave this call.
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath)

      setState('submitting')

      // ── Submit proof to API ───────────────────────────────────────────
      const res = await fetch(`/api/zk/requests/${id}/prove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof, publicSignals }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.code ?? 'Submission failed')

      setVerified(json.data?.verified ?? false)
      setState('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Proof generation failed')
      setState('form')
    }
  }

  // ── States ─────────────────────────────────────────────────────────────

  if (state === 'loading') {
    return <Shell><p className="text-gray-400 animate-pulse">Loading request…</p></Shell>
  }

  if (state === 'error' || !request) {
    return (
      <Shell>
        <p className="text-red-600 font-semibold">Request not found or access denied.</p>
        <button onClick={() => router.push('/disclosures')} className="mt-4 text-sm text-indigo-600 hover:underline">
          Back to disclosures
        </button>
      </Shell>
    )
  }

  if (state === 'proving') {
    return (
      <Shell>
        <div className="text-indigo-500 text-3xl mb-4 animate-spin">⟳</div>
        <p className="font-semibold text-gray-900">Generating zero-knowledge proof…</p>
        <p className="text-gray-400 text-sm mt-2">
          Running Groth16 in your browser. This takes 5–30 seconds.<br />
          Your actual values never leave this tab.
        </p>
      </Shell>
    )
  }

  if (state === 'submitting') {
    return (
      <Shell>
        <p className="text-gray-500 animate-pulse">Verifying on Polygon…</p>
      </Shell>
    )
  }

  if (state === 'done') {
    return (
      <Shell>
        <div className={`text-4xl mb-4 ${verified ? 'text-green-500' : 'text-red-500'}`}>
          {verified ? '✓' : '✗'}
        </div>
        <h2 className="font-semibold text-gray-900">
          {verified ? 'Proof verified on-chain' : 'Proof rejected'}
        </h2>
        <p className="text-gray-500 text-sm mt-2">
          {verified
            ? 'The employer can now see your claim is verified. Your actual value was never revealed.'
            : 'The on-chain verifier rejected the proof. Your value may not meet the requirement.'}
        </p>
        <button
          onClick={() => router.push('/disclosures')}
          className="mt-5 text-sm text-indigo-600 hover:underline"
        >
          Back to disclosures
        </button>
      </Shell>
    )
  }

  // ── Form state ─────────────────────────────────────────────────────────
  const issalary = request.claimType === 'SALARY_RANGE'
  const params = request.claimParams
  const claimLabel = formatClaimLabel(request.claimType, params)

  return (
    <Shell>
      <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-3">
        Zero-Knowledge Proof
      </div>
      <h2 className="font-semibold text-gray-900 mb-1">Prove: {claimLabel}</h2>
      <p className="text-gray-500 text-sm mb-5">
        Enter your real value below. It runs locally in your browser via SnarkJS and is
        <strong className="text-gray-700"> never sent to any server</strong>.
        Only a cryptographic proof travels to ATTESTA.
      </p>

      <form onSubmit={handleProve} className="space-y-4 text-left">
        {issalary ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Your actual salary (USD)
            </label>
            <input
              type="number"
              value={privateValue}
              onChange={e => setPrivateValue(e.target.value)}
              placeholder="e.g. 175000"
              min={0}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm
                         focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              This stays in your browser. Proof only reveals your salary is in the requested range.
            </p>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Your actual tenure (months)
            </label>
            <input
              type="number"
              value={privateValue}
              onChange={e => setPrivateValue(e.target.value)}
              placeholder="e.g. 36"
              min={0}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm
                         focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              Proof only reveals you meet the minimum. Exact tenure not disclosed.
            </p>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            className="flex-1 py-2.5 px-4 bg-indigo-600 text-white text-sm font-semibold
                       rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Generate &amp; submit proof
          </button>
          <button
            type="button"
            onClick={() => router.push('/disclosures')}
            className="py-2.5 px-4 border border-gray-200 text-gray-600 text-sm font-semibold
                       rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
        {children}
      </div>
    </div>
  )
}
