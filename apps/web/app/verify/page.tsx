'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@attesta/ui'

/**
 * /verify — Government ID verification landing page.
 *
 * Initiates the Onfido KYC flow by calling POST /kyc/initiate, which
 * returns an SDK token. We then redirect the user to /verify/liveness
 * where the Onfido Web SDK is loaded with that token.
 *
 * This page does NOT render the Onfido SDK itself — Onfido's SDK is
 * loaded lazily in /verify/liveness to keep the initial page lightweight
 * and to avoid loading third-party scripts on every page load.
 */
export default function VerifyPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function startVerification() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/kyc/initiate', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        const code = data?.error?.code
        if (code === 'ALREADY_VERIFIED') {
          router.push('/dashboard')
          return
        }
        if (code === 'VERIFICATION_PENDING') {
          // Already started — resume the flow
          router.push('/verify/liveness')
          return
        }
        setError(data?.error?.message ?? 'Could not start verification. Please try again.')
        return
      }

      // Store the SDK token in sessionStorage so liveness page can use it
      sessionStorage.setItem('onfido_sdk_token', data.data.sdkToken)
      sessionStorage.setItem('onfido_applicant_id', data.data.applicantId)

      router.push('/verify/liveness')
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">Verify Your Identity</h1>
          <p className="mt-2 text-muted-foreground">
            Government ID verification upgrades your trust score to T1 (10/10).
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What we verify</CardTitle>
            <CardDescription>
              Powered by Onfido — your document images are never stored by ATTESTA.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  1
                </span>
                <span>
                  <strong className="text-foreground">Government ID</strong> — passport, driver's
                  license, or national ID card
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  2
                </span>
                <span>
                  <strong className="text-foreground">Liveness check</strong> — a brief selfie to
                  confirm you're a real person (prevents deepfakes)
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  3
                </span>
                <span>
                  <strong className="text-foreground">ZK anchoring</strong> — the verified result
                  is anchored to Polygon. We store zero document images.
                </span>
              </li>
            </ul>

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              onClick={startVerification}
              disabled={loading}
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Starting verification…' : 'Start identity verification'}
            </button>

            <p className="text-center text-xs text-muted-foreground">
              This takes about 2 minutes.{' '}
              <Link href="/dashboard" className="underline underline-offset-2 hover:text-foreground">
                Skip for now
              </Link>
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Your verification data is processed by Onfido under their{' '}
          <a
            href="https://onfido.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Privacy Policy
          </a>
          . ATTESTA receives only the pass/fail result.
        </p>
      </div>
    </div>
  )
}
