'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function BillingSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const plan = searchParams.get('plan') ?? 'PER_HIRE'

  useEffect(() => {
    const t = setTimeout(() => router.replace('/employer/billing?success=1'), 3000)
    return () => clearTimeout(t)
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="text-xl font-bold mb-2">Payment successful</h1>
        <p className="text-muted-foreground text-sm">
          {plan === 'SUBSCRIPTION'
            ? 'Your monthly subscription is now active.'
            : 'Your per-hire plan is now active.'}
        </p>
        <p className="text-muted-foreground text-xs mt-4">Redirecting…</p>
      </div>
    </div>
  )
}
