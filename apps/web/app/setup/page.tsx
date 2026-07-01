'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@attesta/ui'
import { StepBasic, type StepBasicValues } from './components/step-basic'
import { StepBio, type StepBioValues } from './components/step-bio'
import { StepLinks, type StepLinksValues } from './components/step-links'
import { apiClient } from '@/lib/api-client'

type WizardData = Partial<StepBasicValues & StepBioValues & StepLinksValues>

const STEPS = [
  { title: 'Basic Info', description: 'Tell people who you are' },
  { title: 'About You', description: 'Write a short professional bio' },
  { title: 'Online Presence', description: 'Link your accounts for skill evidence' },
]

export default function SetupPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [data, setData] = useState<WizardData>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accessToken = (session?.user as { accessToken?: string })?.accessToken

  function handleBasic(values: StepBasicValues) {
    setData(prev => ({ ...prev, ...values }))
    setStep(1)
  }

  function handleBio(values: StepBioValues) {
    setData(prev => ({ ...prev, ...values }))
    setStep(2)
  }

  async function handleLinks(values: StepLinksValues) {
    if (!accessToken) {
      setError('Session expired. Please sign in again.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    const payload = { ...data, ...values }

    // GitHub username → store as connected flag for completeness scoring
    const body: Record<string, unknown> = {
      name: payload.name,
      headline: payload.headline,
      location: payload.location,
      bio: payload.bio,
      linkedinUrl: payload.linkedinUrl || null,
      websiteUrl: payload.websiteUrl || null,
    }

    if (payload.githubUsername) {
      body.githubUsername = payload.githubUsername
      body.githubConnected = true
    }

    const result = await apiClient.profile.update(accessToken, body)

    if (!result.success) {
      setIsSubmitting(false)
      setError((result as { error?: { message?: string } }).error?.message ?? 'Something went wrong. Please try again.')
      return
    }

    router.push('/dashboard')
  }

  const current = STEPS[step]

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Step indicator */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.title} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  i < step
                    ? 'bg-primary text-primary-foreground'
                    : i === step
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {i < step ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-12 ${i < step ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{current?.title}</CardTitle>
            <CardDescription>{current?.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {step === 0 && (
              <StepBasic
                defaultValues={{ name: session?.user?.name ?? undefined }}
                onNext={handleBasic}
              />
            )}
            {step === 1 && (
              <StepBio
                defaultValues={data}
                onNext={handleBio}
                onBack={() => setStep(0)}
              />
            )}
            {step === 2 && (
              <StepLinks
                defaultValues={data}
                onNext={handleLinks}
                onBack={() => setStep(1)}
                isLoading={isSubmitting}
              />
            )}
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          You can edit all of this later from your profile settings.
        </p>
      </div>
    </div>
  )
}
