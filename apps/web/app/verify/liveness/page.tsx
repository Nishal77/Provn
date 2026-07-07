'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Phase =
  | 'facetec-loading'   // loading FaceTec SDK
  | 'facetec-ready'     // FaceTec UI is mounted, waiting for user
  | 'facetec-polling'   // FaceTec captured, validating with server
  | 'facetec-error'     // FaceTec failed
  | 'veriff-loading'    // FaceTec passed, creating Veriff session
  | 'veriff-redirect'   // redirected to Veriff-hosted page
  | 'veriff-polling'    // waiting for Veriff webhook decision
  | 'complete'          // T1 verified
  | 'error'

function buildFaceTecProcessor(
  onSuccess: (sessionId: string) => void,
  onFailure: (reason: string) => void
) {
  return class FaceTecProcessor {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async processSessionResultWhileFaceTecSDKWaits(sessionResult: any, sdkNextStep: any) {
      if (sessionResult.status !== 1) {
        onFailure('Session ended without a valid face scan.')
        sdkNextStep.cancel()
        return
      }

      try {
        const res = await fetch('/api/kyc/facetec/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionResult.sessionId,
            faceScan: sessionResult.faceScan,
            auditTrailImage: sessionResult.auditTrail?.[0] ?? '',
            lowQualityAuditTrailImage: sessionResult.lowQualityAuditTrail?.[0] ?? '',
          }),
        })

        const data = await res.json()

        if (!res.ok || !data.success) {
          const code = data?.error?.code
          if (code === 'LIVENESS_FAILED') {
            onFailure('Liveness check did not pass. Please try again in good lighting.')
          } else {
            onFailure(data?.error?.message ?? 'Validation error. Please try again.')
          }
          sdkNextStep.cancel()
          return
        }

        onSuccess(data.data.sessionId)
        sdkNextStep.proceedToNextStep(sessionResult.faceScanResultBlob)
      } catch {
        onFailure('Network error during liveness validation. Please try again.')
        sdkNextStep.cancel()
      }
    }
  }
}

export default function LivenessPage() {
  const router = useRouter()
  const facetecMountRef = useRef<HTMLDivElement>(null)

  const [phase, setPhase] = useState<Phase>('facetec-loading')
  const [message, setMessage] = useState('Loading 3D liveness check…')

  // ── Step 2b: Poll for T1 approval ─────────────────────────────
  const pollForT1 = useCallback(async () => {
    setPhase('veriff-polling')
    setMessage('Waiting for document verification result…')

    const MAX_POLLS = 30
    const INTERVAL_MS = 4_000

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, INTERVAL_MS))

      try {
        const res = await fetch('/api/kyc/status')
        if (!res.ok) continue

        const data = await res.json()

        if (data?.data?.tier === 'T1_GOVERNMENT') {
          setPhase('complete')
          setMessage('Identity verified! Redirecting…')
          router.push('/dashboard?verified=1')
          return
        }

        if (data?.data?.status === 'REJECTED') {
          setPhase('error')
          setMessage('Document verification was not successful. Please contact support or try again.')
          return
        }
      } catch {
        // Network hiccup — keep polling
      }
    }

    setPhase('complete')
    setMessage('Document submitted. Verification usually completes within a few minutes.')
    router.push('/dashboard')
  }, [router])

  // ── Step 2a: Create Veriff session → open in new tab ──────────
  const startVeriffDocumentCheck = useCallback(async () => {
    setPhase('veriff-loading')
    setMessage('Creating document verification session…')

    try {
      const res = await fetch('/api/kyc/initiate', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        const code = data?.error?.code
        if (code === 'ALREADY_VERIFIED') {
          router.push('/dashboard')
          return
        }
        setPhase('error')
        setMessage(data?.error?.message ?? 'Could not start document check. Please try again.')
        return
      }

      const { verificationUrl } = data.data as { verificationUrl: string; sessionId: string }

      // Open Veriff in a new tab — no SDK download needed
      window.open(verificationUrl, '_blank', 'noopener,noreferrer')

      setPhase('veriff-redirect')
      setMessage('Document verification opened in a new tab. Complete the steps there, then return here.')

      // Start polling once user has been redirected
      setTimeout(pollForT1, 5_000)
    } catch {
      setPhase('error')
      setMessage('Network error. Please check your connection and try again.')
    }
  }, [router, pollForT1])

  // ── Step 1: Load FaceTec 3D liveness SDK ──────────────────────
  useEffect(() => {
    const deviceKeyIdentifier = process.env.NEXT_PUBLIC_FACETEC_DEVICE_KEY_IDENTIFIER
    const faceScanEncryptionKey = process.env.NEXT_PUBLIC_FACETEC_FACE_SCAN_ENCRYPTION_KEY

    if (!deviceKeyIdentifier || !faceScanEncryptionKey) {
      // FaceTec not configured — skip liveness, go straight to Veriff
      setPhase('facetec-polling')
      setMessage('Loading document scanner…')
      return
    }

    const sdkPath = process.env.NEXT_PUBLIC_FACETEC_SDK_PATH ?? '/facetec'
    const script = document.createElement('script')
    script.src = `${sdkPath}/FaceTecSDK.js`
    script.async = true

    script.onload = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const FaceTecSDK = (window as any).FaceTecSDK

      if (!FaceTecSDK) {
        setPhase('facetec-error')
        setMessage('Could not load liveness SDK. Please refresh and try again.')
        return
      }

      let sessionToken: string
      try {
        const res = await fetch('/api/kyc/facetec/session')
        const data = await res.json()

        if (!res.ok) {
          const code = data?.error?.code
          if (code === 'ALREADY_VERIFIED') {
            router.push('/dashboard')
            return
          }
          setPhase('facetec-error')
          setMessage(data?.error?.message ?? 'Could not start liveness check.')
          return
        }

        sessionToken = data.data.sessionToken
      } catch {
        setPhase('facetec-error')
        setMessage('Network error. Please check your connection.')
        return
      }

      FaceTecSDK.initializeInDevelopmentMode(
        deviceKeyIdentifier,
        faceScanEncryptionKey,
        (initSuccess: boolean) => {
          if (!initSuccess) {
            setPhase('facetec-error')
            setMessage('Liveness SDK initialization failed. Please try again.')
            return
          }

          setPhase('facetec-ready')
          setMessage('')

          const Processor = buildFaceTecProcessor(
            (_sessionId: string) => {
              setPhase('facetec-polling')
              setMessage('Liveness confirmed. Loading document scanner…')
            },
            (reason: string) => {
              setPhase('facetec-error')
              setMessage(reason)
            }
          )

          const processor = new Processor()
          FaceTecSDK.FaceTecSession(processor, sessionToken, {
            onComplete: () => {
              if (phase !== 'facetec-error') {
                startVeriffDocumentCheck()
              }
            },
          })
        }
      )
    }

    script.onerror = () => {
      setPhase('facetec-error')
      setMessage('Could not load liveness SDK. Check public/facetec/ files.')
    }

    document.head.appendChild(script)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // After FaceTec polling phase, start Veriff
  useEffect(() => {
    if (phase === 'facetec-polling') {
      const timer = setTimeout(startVeriffDocumentCheck, 1_500)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [phase, startVeriffDocumentCheck])

  const stepLabel = phase.startsWith('facetec') ? 'Step 1 of 2 — 3D Liveness' : 'Step 2 of 2 — Document'
  const isLoading = ['facetec-loading', 'facetec-polling', 'veriff-loading', 'veriff-polling'].includes(phase)
  const isError = phase === 'facetec-error' || phase === 'error'
  const isDone = phase === 'complete'
  const isWaitingForVeriff = phase === 'veriff-redirect'

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-12">
      {!isDone && (
        <div className="mb-8 flex items-center gap-3">
          <StepDot
            label="3D Liveness"
            number={1}
            active={phase.startsWith('facetec')}
            done={phase.startsWith('veriff') || isDone}
          />
          <div className="h-px w-12 bg-border" />
          <StepDot
            label="Document"
            number={2}
            active={phase.startsWith('veriff')}
            done={isDone}
          />
        </div>
      )}

      <div className="mb-8 flex flex-col items-center gap-4 text-center">
        {isLoading && (
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        )}
        {isDone && (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
            <CheckIcon />
          </div>
        )}
        {isError && (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <XIcon />
          </div>
        )}

        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {stepLabel}
        </p>

        {message && (
          <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
        )}

        {isWaitingForVeriff && (
          <button
            onClick={pollForT1}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            I&apos;ve completed verification
          </button>
        )}

        {isError && (
          <button
            onClick={() => router.push('/verify')}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
        )}
      </div>

      <div ref={facetecMountRef} className="hidden" />
    </div>
  )
}

function StepDot({ number, label, active, done }: { number: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={[
          'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors',
          done
            ? 'bg-green-500 text-white'
            : active
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground',
        ].join(' ')}
      >
        {done ? <CheckIcon size={14} /> : number}
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function CheckIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
