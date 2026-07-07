'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@attesta/ui'

export default function VerifyPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  function startVerification() {
    setLoading(true)
    router.push('/verify/liveness')
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
              Powered by Veriff — your document images are never stored by ATTESTA.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  1
                </span>
                <span>
                  <strong className="text-foreground">3D liveness check</strong> — confirms you are
                  a real person (prevents deepfakes and Sybil attacks)
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  2
                </span>
                <span>
                  <strong className="text-foreground">Government ID</strong> — passport,
                  driver&apos;s license, or national ID card (via Veriff)
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

            <button
              onClick={startVerification}
              disabled={loading}
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Starting…' : 'Start identity verification'}
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
          Document verification is processed by Veriff under their{' '}
          <a
            href="https://www.veriff.com/privacy-notice"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Privacy Notice
          </a>
          . ATTESTA receives only the pass/fail result.
        </p>
      </div>
    </div>
  )
}
