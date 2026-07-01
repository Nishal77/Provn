'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, Card, CardContent, CardFooter, Input, Label } from '@attesta/ui'
import { OAuthButtons } from './oauth-buttons'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password required'),
})

type FormValues = z.infer<typeof schema>

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard'
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setServerError(null)

    const result = await signIn('credentials', {
      email: values.email,
      password: values.password,
      redirect: false,
    })

    if (result?.error) {
      setServerError('Invalid email or password. Please try again.')
      return
    }

    router.push(callbackUrl)
    router.refresh()
  }

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4 pt-6">
          {serverError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </p>
          )}

          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
            />
          </div>

          <Button type="submit" className="w-full" loading={isSubmitting}>
            Sign In
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <OAuthButtons callbackUrl={callbackUrl} />
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            No account?{' '}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Create one free
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
