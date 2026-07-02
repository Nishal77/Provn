'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Input, Label } from '@attesta/ui'
import { apiClient } from '@/lib/api-client'

const schema = z.object({
  name: z.string().min(2, 'At least 2 characters').max(100),
  headline: z.string().max(160, 'Max 160 characters').optional().or(z.literal('')),
  bio: z.string().max(2000, 'Max 2000 characters').optional().or(z.literal('')),
  location: z.string().max(100).optional().or(z.literal('')),
  linkedinUrl: z.string().url('Enter a valid URL').optional().or(z.literal('')),
  websiteUrl: z.string().url('Enter a valid URL').optional().or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

export default function ProfileEditPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const accessToken = (session?.user as { accessToken?: string })?.accessToken

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const bioLength = watch('bio')?.length ?? 0

  // Load current profile values into the form
  useEffect(() => {
    if (!accessToken) return

    apiClient.profile.getMe(accessToken).then(res => {
      if (res.success) {
        const profile = (res.data as { profile: Partial<FormValues> }).profile
        reset({
          name: profile.name ?? '',
          headline: profile.headline ?? '',
          bio: profile.bio ?? '',
          location: profile.location ?? '',
          linkedinUrl: profile.linkedinUrl ?? '',
          websiteUrl: profile.websiteUrl ?? '',
        })
      }
    })
  }, [accessToken, reset])

  async function onSubmit(values: FormValues) {
    if (!accessToken) return

    setServerError(null)
    setSaved(false)

    const result = await apiClient.profile.update(accessToken, values as Record<string, unknown>)

    if (!result.success) {
      setServerError((result as { error?: { message?: string } }).error?.message ?? 'Save failed. Please try again.')
      return
    }

    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Edit Profile</h1>
        <p className="text-sm text-muted-foreground">
          Changes appear on your public ProofWork profile immediately.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Keep this professional — employers and peers will see this.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {serverError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {serverError}
              </div>
            )}
            {saved && (
              <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                Profile saved successfully.
              </div>
            )}

            <div>
              <Label htmlFor="name">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input id="name" error={errors.name?.message} {...register('name')} />
            </div>

            <div>
              <Label htmlFor="headline">Professional Headline</Label>
              <Input
                id="headline"
                placeholder="Senior Full-Stack Engineer · Open to work"
                error={errors.headline?.message}
                {...register('headline')}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                One line shown under your name on your public profile.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="bio">About You</Label>
                <span className="text-xs text-muted-foreground">{bioLength}/2000</span>
              </div>
              <textarea
                id="bio"
                rows={5}
                placeholder="I'm a full-stack engineer with 5 years in fintech..."
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('bio')}
              />
              {errors.bio && (
                <p className="text-xs text-destructive">{errors.bio.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="San Francisco, CA"
                {...register('location')}
              />
            </div>

            <hr className="border-border" />

            <div>
              <Label htmlFor="linkedin">LinkedIn URL</Label>
              <Input
                id="linkedin"
                placeholder="https://linkedin.com/in/yourname"
                error={errors.linkedinUrl?.message}
                {...register('linkedinUrl')}
              />
            </div>

            <div>
              <Label htmlFor="website">Personal Website</Label>
              <Input
                id="website"
                placeholder="https://yoursite.com"
                error={errors.websiteUrl?.message}
                {...register('websiteUrl')}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => router.push('/dashboard')}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" loading={isSubmitting}>
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
