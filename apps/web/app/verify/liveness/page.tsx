'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type OndidoStatus = 'loading' | 'ready' | 'completed' | 'error' | 'polling'

/**
 * /verify/liveness — Onfido Web SDK host page.
 *
 * This page:
 *   1. Reads the SDK token from sessionStorage (set by /verify).
 *   2. Dynamically loads the Onfido Web SDK script (not bundled — it's large
 *      and only needed on this one page).
 *   3. Mounts the Onfido UI into #onfido-mount.
 *   4. On completion, polls GET /kyc/status until the webhook has been
 *      processed and the user's tier is upgraded to T1.
 *   5. Redirects to /dashboard when confirmed.
 */
export default function LivenessPage() {
  const router = useRouter()
  const mountRef = useRef<HTMLDivElement>(null)
  const onfidoInstanceRef = useRef<{ tearDown: () => void } | null>(null)
  const [status, setStatus] = useState<OndidoStatus>('loading')
  const [message, setMessage] = useState('Loading identity verification…')

  // Polls /kyc/status until tier = T1_GOVERNMENT or max attempts reached
  const pollForUpgrade = useCallback(async () => {
    setStatus('polling')
    setMessage('Waiting for verification result…')

    const MAX_POLLS = 20
    const INTERVAL_MS = 3000

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, INTERVAL_MS))

      try {
        const res = await fetch('/api/kyc/status')
        if (!res.ok) continue

        const data = await res.json()
        const tier = data?.data?.tier

        if (tier === 'T1_GOVERNMENT') {
          setStatus('completed')
          setMessage('Verification complete! Redirecting…')
          router.push('/dashboard?verified=1')
          return
        }

        if (data?.data?.status === 'REJECTED') {
          setStatus('error')
          setMessage(
            'Identity verification was not successful. Please contact support or try again.'
          )
          return
        }
      } catch {
        // Network hiccup — continue polling
      }
    }

    // Timed out — tell the user the webhook may arrive soon
    setStatus('completed')
    setMessage(
      'Verification submitted. It usually takes under a minute. Check your dashboard for the result.'
    )
    router.push('/dashboard')
  }, [router])

  useEffect(() => {
    const sdkToken = sessionStorage.getItem('onfido_sdk_token')

    if (!sdkToken) {
      // No token — user navigated here directly, send them back
      router.replace('/verify')
      return
    }

    // Dynamically load the Onfido Web SDK.
    // We intentionally load this at runtime (not in package.json) because:
    //   a) It's a large script only needed on this one page.
    //   b) It includes FaceTec liveness — we want it isolated.
    const script = document.createElement('script')
    script.src = 'https://assets.onfido.com/web-sdk-releases/14.15.0/onfido.min.js'
    script.async = true

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://assets.onfido.com/web-sdk-releases/14.15.0/style.css'

    script.onload = () => {
      if (!mountRef.current) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Onfido = (window as any).Onfido

      if (!Onfido?.init) {
        setStatus('error')
        setMessage('Could not load identity verification SDK. Please refresh and try again.')
        return
      }

      try {
        onfidoInstanceRef.current = Onfido.init({
          token: sdkToken,
          containerId: 'onfido-mount',
          steps: ['welcome', 'document', 'face', 'complete'],
          onComplete: () => {
            // Onfido has captured ID + selfie — the check is now processing.
            // Our webhook will fire when done.
            sessionStorage.removeItem('onfido_sdk_token')
            sessionStorage.removeItem('onfido_applicant_id')
            onfidoInstanceRef.current?.tearDown()
            pollForUpgrade()
          },
          onError: (err: unknown) => {
            console.error('Onfido SDK error:', err)
            setStatus('error')
            setMessage('An error occurred during verification. Please try again.')
          },
          onUserExit: () => {
            router.push('/verify')
          },
        })

        setStatus('ready')
        setMessage('')
      } catch (err) {
        console.error('Onfido init failed:', err)
        setStatus('error')
        setMessage('Could not initialise identity verification. Please refresh and try again.')
      }
    }

    script.onerror = () => {
      setStatus('error')
      setMessage('Could not load identity verification SDK. Please check your connection.')
    }

    document.head.appendChild(link)
    document.head.appendChild(script)

    return () => {
      onfidoInstanceRef.current?.tearDown()
    }
  }, [router, pollForUpgrade])

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-12">
      {/* Status overlay — shown while loading or polling, hidden once SDK is mounted */}
      {status !== 'ready' && (
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          {status === 'loading' || status === 'polling' ? (
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          ) : status === 'completed' ? (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
          {message && (
            <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
          )}
          {status === 'error' && (
            <button
              onClick={() => router.push('/verify')}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {/* Onfido SDK mounts into this div */}
      <div
        id="onfido-mount"
        ref={mountRef}
        className="w-full max-w-xl"
      />
    </div>
  )
}
