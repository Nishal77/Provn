'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface DnsInstructions {
  recordType: string
  hostname: string
  value: string
  ttl: number
}

interface RegisterResult {
  employer: { id: string; name: string; domain: string }
  verificationToken: string
  dnsInstructions: DnsInstructions
}

export default function EmployerRegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<'form' | 'dns'>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RegisterResult | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    domain: '',
    website: '',
    industry: '',
    size: '',
    billingEmail: '',
  })

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/employer/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error?.message ?? 'Registration failed.')
        return
      }

      setResult(data.data)
      setStep('dns')
    } catch {
      setError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify() {
    setVerifying(true)
    setVerifyMsg(null)

    try {
      const res = await fetch('/api/employer/verify-domain', { method: 'POST' })
      const data = await res.json()

      if (data.data?.verified) {
        setVerifyMsg('✓ Domain verified! Redirecting to dashboard...')
        setTimeout(() => router.push('/employer/dashboard'), 1500)
      } else {
        setVerifyMsg('DNS record not found yet. TXT records can take up to 48h to propagate.')
      }
    } catch {
      setVerifyMsg('Verification check failed. Try again.')
    } finally {
      setVerifying(false)
    }
  }

  if (step === 'dns' && result) {
    const dns = result.dnsInstructions
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <h1 className="text-2xl font-bold mb-2">Verify your domain</h1>
        <p className="text-muted-foreground mb-6">
          Add the TXT record below to your DNS provider to prove ownership of{' '}
          <strong>{result.employer.domain}</strong>.
        </p>

        <div className="rounded-lg border bg-muted/40 p-6 mb-6 space-y-3 font-mono text-sm">
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <span className="text-muted-foreground">Record type</span>
            <span>{dns.recordType}</span>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <span className="text-muted-foreground">Hostname</span>
            <span className="break-all">{dns.hostname}</span>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <span className="text-muted-foreground">Value</span>
            <span className="break-all">{dns.value}</span>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <span className="text-muted-foreground">TTL</span>
            <span>{dns.ttl}</span>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          After adding the record, click below. DNS propagation can take up to 48 hours.
        </p>

        {verifyMsg && (
          <p
            className={`mb-4 text-sm font-medium ${
              verifyMsg.startsWith('✓') ? 'text-green-600' : 'text-amber-600'
            }`}
          >
            {verifyMsg}
          </p>
        )}

        <button
          onClick={handleVerify}
          disabled={verifying}
          className="rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-60"
        >
          {verifying ? 'Checking DNS...' : 'Verify domain'}
        </button>
      </div>
    )
  }

  const sizes = ['1-10', '11-50', '51-200', '201-500', '500+']
  const industries = [
    'Technology', 'Finance', 'Healthcare', 'Education', 'Retail',
    'Manufacturing', 'Media', 'Consulting', 'Other',
  ]

  return (
    <div className="max-w-lg mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-1">Register your company</h1>
      <p className="text-muted-foreground mb-8 text-sm">
        Create an employer account to access verified candidates.
      </p>

      <form onSubmit={handleRegister} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1.5">Company name *</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Acme Corp"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Company domain *</label>
          <input
            required
            value={form.domain}
            onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
            placeholder="acme.com"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <p className="text-xs text-muted-foreground mt-1">You&apos;ll verify this via DNS TXT record.</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Billing email *</label>
          <input
            required
            type="email"
            value={form.billingEmail}
            onChange={(e) => setForm((f) => ({ ...f, billingEmail: e.target.value }))}
            placeholder="billing@acme.com"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Website</label>
          <input
            value={form.website}
            onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
            placeholder="https://acme.com"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Industry</label>
            <select
              value={form.industry}
              onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Select…</option>
              {industries.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Company size</label>
            <select
              value={form.size}
              onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Select…</option>
              {sizes.map((s) => (
                <option key={s} value={s}>{s} employees</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive font-medium">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-60"
        >
          {loading ? 'Registering…' : 'Register company →'}
        </button>
      </form>
    </div>
  )
}
