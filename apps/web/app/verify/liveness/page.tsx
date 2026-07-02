'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Phase =
  | 'facetec-loading'   // loading FaceTec SDK
  | 'facetec-ready'     // FaceTec UI is mounted, waiting for user
  | 'facetec-polling'   // FaceTec captured, validating with server
  | 'facetec-error'     // FaceTec failed
  | 'onfido-loading'    // FaceTec passed, loading Onfido SDK
  | 'onfido-ready'      // Onfido document UI is mounted
  | 'onfido-polling'    // Onfido captured, waiting for webhook result
  | 'complete'          // T1 verified
  | 'error'

// ─────────────────────────────────────────────
// FaceTec Processor
//
// FaceTec's SDK calls processSessionResultWhileFaceTecSDKWaits() with the
// encrypted faceScan data. We forward it to our backend for validation,
// then signal the SDK whether to proceed or cancel.
// ─────────────────────────────────────────────

function buildFaceTecProcessor(
  onSuccess: (sessionId: string) => void,
  onFailure: (reason: string) => void
) {
  return class FaceTecProcessor {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async processSessionResultWhileFaceTecSDKWaits(sessionResult: any, sdkNextStep: any) {
      // Status 1 = FACE_SCAN_GOOD — anything else means user cancelled or low quality
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

        // Tell the SDK to show a success animation, then close
        onSuccess(data.data.sessionId)
        sdkNextStep.proceedToNextStep(sessionResult.faceScanResultBlob)
      } catch {
        onFailure('Network error during liveness validation. Please try again.')
        sdkNextStep.cancel()
      }
    }
  }
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function LivenessPage() {
  const router = useRouter()
  const facetecMountRef = useRef<HTMLDivElement>(null)
  const onfidoMountRef = useRef<HTMLDivElement>(null)
  const onfidoInstanceRef = useRef<{ tearDown: () => void } | null>(null)

  const [phase, setPhase] = useState<Phase>('facetec-loading')
  const [message, setMessage] = useState('Loading 3D liveness check…')

  // ── Step 2: Poll Onfido webhook result ─────────────────────────
  const pollForT1 = useCallback(async () => {
    setPhase('onfido-polling')
    setMessage('Verifying identity document…')

    const MAX_POLLS = 20
    const INTERVAL_MS = 3_000

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

    // Webhook may still be in flight
    setPhase('complete')
    setMessage('Document submitted. Verification usually takes under a minute.')
    router.push('/dashboard')
  }, [router])

  // ── Step 2: Load Onfido document SDK ──────────────────────────
  const startOnfidoDocumentCheck = useCallback(async () => {
    setPhase('onfido-loading')
    setMessage('Loading document scanner…')

    // Retrieve Onfido SDK token from our backend
    let sdkToken: string
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

      sdkToken = data.data.sdkToken
    } catch {
      setPhase('error')
      setMessage('Network error. Please check your connection and try again.')
      return
    }

    // Dynamically load Onfido SDK — document step only, no face step
    const script = document.createElement('script')
    script.src = 'https://assets.onfido.com/web-sdk-releases/14.15.0/onfido.min.js'
    script.async = true

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://assets.onfido.com/web-sdk-releases/14.15.0/style.css'

    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Onfido = (window as any).Onfido

      if (!Onfido?.init) {
        setPhase('error')
        setMessage('Could not load document scanner. Please refresh and try again.')
        return
      }

      try {
        onfidoInstanceRef.current = Onfido.init({
          token: sdkToken,
          containerId: 'onfido-mount',
          // 'face' step intentionally omitted — FaceTec 3D handled liveness in Step 1
          steps: ['welcome', 'document', 'complete'],
          onComplete: () => {
            onfidoInstanceRef.current?.tearDown()
            pollForT1()
          },
          onError: () => {
            setPhase('error')
            setMessage('Document capture failed. Please try again.')
          },
          onUserExit: () => {
            router.push('/verify')
          },
        })

        setPhase('onfido-ready')
        setMessage('')
      } catch {
        setPhase('error')
        setMessage('Could not start document scanner. Please refresh and try again.')
      }
    }

    script.onerror = () => {
      setPhase('error')
      setMessage('Could not load document scanner. Please check your connection.')
    }

    document.head.appendChild(link)
    document.head.appendChild(script)
  }, [router, pollForT1])

  // ── Step 1: Load FaceTec 3D liveness SDK ──────────────────────
  useEffect(() => {
    const deviceKeyIdentifier = process.env.NEXT_PUBLIC_FACETEC_DEVICE_KEY_IDENTIFIER
    const faceScanEncryptionKey = process.env.NEXT_PUBLIC_FACETEC_FACE_SCAN_ENCRYPTION_KEY

    if (!deviceKeyIdentifier || !faceScanEncryptionKey) {
      setPhase('error')
      setMessage('Liveness service not configured. Please contact support.')
      return
    }

    // FaceTec SDK is self-hosted — place SDK files in public/facetec/ after licensing.
    // Download from: https://dev.facetec.com/downloads (requires FaceTec account)
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

      // Fetch a session token from our backend (which calls FaceTec server)
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

      // Initialize FaceTec SDK — runs entirely client-side
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

          // Build processor and launch a liveness session
          const Processor = buildFaceTecProcessor(
            // onSuccess: FaceTec liveness passed → move to Onfido doc check
            (_sessionId: string) => {
              setPhase('facetec-polling')
              setMessage('Liveness confirmed. Loading document scanner…')
            },
            // onFailure
            (reason: string) => {
              setPhase('facetec-error')
              setMessage(reason)
            }
          )

          const processor = new Processor()
          // FaceTec's SDK calls processor.processSessionResultWhileFaceTecSDKWaits
          // when a scan is captured. On the SDK's onComplete callback, move to Onfido.
          FaceTecSDK.FaceTecSession(processor, sessionToken, {
            onComplete: () => {
              // SDK UI is done — if liveness passed, the processor set phase to polling
              // We now start the Onfido doc check
              if (phase !== 'facetec-error') {
                startOnfidoDocumentCheck()
              }
            },
          })
        }
      )
    }

    script.onerror = () => {
      setPhase('facetec-error')
      setMessage('Could not load liveness SDK. If you placed SDK files in public/facetec/, check the path.')
    }

    document.head.appendChild(script)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // After FaceTec polling phase sets success, kick off Onfido
  useEffect(() => {
    if (phase === 'facetec-polling') {
      const timer = setTimeout(startOnfidoDocumentCheck, 1_500)
      return () => clearTimeout(timer)
    }
  }, [phase, startOnfidoDocumentCheck])

  // Cleanup Onfido on unmount
  useEffect(() => {
    return () => { onfidoInstanceRef.current?.tearDown() }
  }, [])

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  const stepLabel = phase.startsWith('facetec') ? 'Step 1 of 2 — 3D Liveness' : 'Step 2 of 2 — Document'
  const isLoading = phase === 'facetec-loading' || phase === 'facetec-polling' || phase === 'onfido-loading' || phase === 'onfido-polling'
  const isError = phase === 'facetec-error' || phase === 'error'
  const isDone = phase === 'complete'
  const isSdkActive = phase === 'facetec-ready' || phase === 'onfido-ready'

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-12">
      {/* Step indicator */}
      {!isDone && (
        <div className="mb-8 flex items-center gap-3">
          <StepDot
            label="3D Liveness"
            number={1}
            active={phase.startsWith('facetec')}
            done={phase.startsWith('onfido') || isDone}
          />
          <div className="h-px w-12 bg-border" />
          <StepDot
            label="Document"
            number={2}
            active={phase.startsWith('onfido')}
            done={isDone}
          />
        </div>
      )}

      {/* Status overlay */}
      {!isSdkActive && (
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

          {!isSdkActive && (
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {stepLabel}
            </p>
          )}

          {message && (
            <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
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
      )}

      {/* FaceTec mounts itself into a full-screen overlay — no div needed */}
      {/* Onfido document SDK mount point */}
      <div
        id="onfido-mount"
        ref={onfidoMountRef}
        className="w-full max-w-xl"
      />
      {/* Unused ref kept for potential future direct DOM access */}
      <div ref={facetecMountRef} className="hidden" />
    </div>
  )
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

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
