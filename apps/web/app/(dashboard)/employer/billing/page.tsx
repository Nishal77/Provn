'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

interface Employer {
  id: string
  name: string
  domain: string
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED'
  stripePlan: 'PER_HIRE' | 'SUBSCRIPTION'
  billingEmail: string | null
}

export default function EmployerBillingPage() {
  const searchParams = useSearchParams()
  const justPaid = searchParams.get('success') === '1'

  const [employer, setEmployer] = useState<Employer | null>(null)
  const [loading, setLoading] = useState(true)
  const [redirecting, setRedirecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/employer/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setEmployer(d.data.employer)
        else setError(d.error?.message ?? 'Could not load employer.')
      })
      .catch(() => setError('Network error.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleCheckout(plan: 'PER_HIRE' | 'SUBSCRIPTION') {
    setRedirecting(true)
    setError(null)

    try {
      const res = await fetch('/api/employer/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error?.message ?? 'Checkout failed.')
        setRedirecting(false)
        return
      }

      window.location.href = data.data.checkoutUrl
    } catch {
      setError('Network error.')
      setRedirecting(false)
    }
  }

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
  }

  if (!employer) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 text-center">
        <p className="text-muted-foreground mb-4">No employer account found.</p>
        <a
          href="/employer/register"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Register your company →
        </a>
      </div>
    )
  }

  if (employer.status !== 'ACTIVE') {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 text-center">
        <p className="text-muted-foreground mb-4">
          Domain not yet verified. Verify <strong>{employer.domain}</strong> first.
        </p>
        <a
          href="/employer/register"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Complete domain verification →
        </a>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-1">Billing</h1>
      <p className="text-muted-foreground text-sm mb-8">
        {employer.name} · {employer.domain}
      </p>

      {justPaid && (
        <div className="mb-6 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Payment successful. Your plan is now active.
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Per-hire plan */}
        <div
          className={`rounded-xl border p-6 ${
            employer.stripePlan === 'PER_HIRE'
              ? 'border-primary bg-primary/5 ring-1 ring-primary'
              : 'bg-card'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">Pay per hire</h2>
            {employer.stripePlan === 'PER_HIRE' && (
              <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                Current
              </span>
            )}
          </div>
          <p className="text-3xl font-bold mb-1">
            $99 <span className="text-base font-normal text-muted-foreground">/hire</span>
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Pay only when you make a hire. No monthly commitment.
          </p>
          <ul className="space-y-2 text-sm mb-6">
            <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Access to verified candidates</li>
            <li className="flex items-center gap-2"><span className="text-green-500">✓</span> FitScore matching</li>
            <li className="flex items-center gap-2"><span className="text-green-500">✓</span> WorkProof Live trials</li>
          </ul>
          <button
            onClick={() => handleCheckout('PER_HIRE')}
            disabled={redirecting || employer.stripePlan === 'PER_HIRE'}
            className="w-full rounded-md border border-primary bg-transparent px-4 py-2 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50 transition-colors"
          >
            {employer.stripePlan === 'PER_HIRE' ? 'Current plan' : 'Switch to per-hire'}
          </button>
        </div>

        {/* Subscription plan */}
        <div
          className={`rounded-xl border p-6 ${
            employer.stripePlan === 'SUBSCRIPTION'
              ? 'border-primary bg-primary/5 ring-1 ring-primary'
              : 'bg-card'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">Subscription</h2>
            {employer.stripePlan === 'SUBSCRIPTION' && (
              <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                Current
              </span>
            )}
          </div>
          <p className="text-3xl font-bold mb-1">
            $2,000 <span className="text-base font-normal text-muted-foreground">/month</span>
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Unlimited hires. Best for teams hiring 25+ per month.
          </p>
          <ul className="space-y-2 text-sm mb-6">
            <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Everything in per-hire</li>
            <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Unlimited candidate access</li>
            <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Priority support</li>
            <li className="flex items-center gap-2"><span className="text-green-500">✓</span> TrustChain referral board</li>
          </ul>
          <button
            onClick={() => handleCheckout('SUBSCRIPTION')}
            disabled={redirecting || employer.stripePlan === 'SUBSCRIPTION'}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {employer.stripePlan === 'SUBSCRIPTION' ? 'Current plan' : 'Upgrade to subscription'}
          </button>
        </div>
      </div>

      {redirecting && (
        <p className="mt-4 text-center text-sm text-muted-foreground">Redirecting to Stripe…</p>
      )}
    </div>
  )
}
