'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface DomainVerification {
  token: string
  verified: boolean
  domain: string
  attempts: number
}

interface Employer {
  id: string
  name: string
  domain: string
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED'
  stripePlan: 'PER_HIRE' | 'SUBSCRIPTION'
  billingEmail: string | null
  totalHires: number
  currentMonth: number
  domainVerifications: DomainVerification[]
}

const STATUS_LABELS: Record<Employer['status'], { label: string; color: string }> = {
  PENDING: { label: 'Pending verification', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  ACTIVE: { label: 'Active', color: 'text-green-700 bg-green-50 border-green-200' },
  SUSPENDED: { label: 'Suspended', color: 'text-red-700 bg-red-50 border-red-200' },
}

export default function EmployerDashboardClient() {
  const [employer, setEmployer] = useState<Employer | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/employer/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setEmployer(d.data.employer)
        else setNotFound(true)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [])

  async function recheckDomain() {
    setVerifying(true)
    setVerifyMsg(null)

    try {
      const res = await fetch('/api/employer/verify-domain', { method: 'POST' })
      const data = await res.json()

      if (data.data?.verified) {
        setVerifyMsg('✓ Domain verified!')
        // Re-fetch employer to reflect new ACTIVE status
        const updated = await fetch('/api/employer/me').then((r) => r.json())
        if (updated.success) setEmployer(updated.data.employer)
      } else {
        setVerifyMsg('TXT record not found yet. Records can take up to 48h to propagate.')
      }
    } catch {
      setVerifyMsg('Check failed. Try again.')
    } finally {
      setVerifying(false)
    }
  }

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
  }

  if (notFound || !employer) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 text-center">
        <p className="text-muted-foreground mb-4">No employer account found.</p>
        <Link
          href="/employer/register"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Register your company →
        </Link>
      </div>
    )
  }

  const status = STATUS_LABELS[employer.status]
  const pendingDns = employer.domainVerifications.find((v) => !v.verified)

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{employer.name}</h1>
          <p className="text-sm text-muted-foreground">{employer.domain}</p>
        </div>
        <span className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${status.color}`}>
          {status.label}
        </span>
      </div>

      {/* Domain verification banner */}
      {employer.status === 'PENDING' && pendingDns && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-900 mb-1">Domain verification required</h2>
          <p className="text-sm text-amber-700 mb-3">
            Add this TXT record to your DNS at{' '}
            <code className="font-mono">_attesta.{employer.domain}</code>:
          </p>
          <code className="block break-all font-mono text-xs bg-white border border-amber-200 rounded px-3 py-2 text-amber-900 mb-4">
            {pendingDns.token}
          </code>
          {verifyMsg && (
            <p className={`text-sm mb-3 font-medium ${verifyMsg.startsWith('✓') ? 'text-green-700' : 'text-amber-700'}`}>
              {verifyMsg}
            </p>
          )}
          <button
            onClick={recheckDomain}
            disabled={verifying}
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {verifying ? 'Checking…' : 'Re-check DNS'}
          </button>
        </div>
      )}

      {/* Suspended banner */}
      {employer.status === 'SUSPENDED' && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <h2 className="font-semibold text-red-900 mb-1">Account suspended</h2>
          <p className="text-sm text-red-700 mb-3">
            Your subscription lapsed or a policy issue was detected. Update billing to restore access.
          </p>
          <Link
            href="/employer/billing"
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Update billing →
          </Link>
        </div>
      )}

      {/* Stats */}
      {employer.status === 'ACTIVE' && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Total hires" value={employer.totalHires} />
          <StatCard label="Hires this month" value={employer.currentMonth} />
          <StatCard
            label="Plan"
            value={employer.stripePlan === 'SUBSCRIPTION' ? 'Subscription' : 'Per hire'}
          />
        </div>
      )}

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-2">
        {employer.status === 'ACTIVE' && (
          <ActionCard
            href="/employer/billing"
            title="Billing"
            description={
              employer.stripePlan === 'SUBSCRIPTION'
                ? '$2,000/month subscription active'
                : '$99/hire — pay as you go'
            }
          />
        )}
        <ActionCard
          href="/employer/register"
          title="Company settings"
          description={`${employer.name} · ${employer.domain}`}
        />
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}

function ActionCard({
  href,
  title,
  description,
}: {
  href: string
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border bg-card p-5 hover:border-primary/50 hover:bg-primary/5 transition-colors group"
    >
      <p className="font-semibold group-hover:text-primary">{title} →</p>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </Link>
  )
}
