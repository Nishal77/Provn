'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, Card, CardContent, CardFooter, Input, Label } from '@attesta/ui'
import { OAuthButtons } from './oauth-buttons'

const schema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().email('Enter a valid email'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must include an uppercase letter')
      .regex(/[0-9]/, 'Must include a number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type FormValues = z.infer<typeof schema>

export function SignupForm() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setServerError(null)

    // Call the Fastify API directly for registration (Auth.js handles sessions)
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: values.name, email: values.email, password: values.password }),
      credentials: 'include',
    })

    const data = await res.json()

    if (!data.success) {
      setServerError(data.error?.message ?? 'Something went wrong. Please try again.')
      return
    }

    // After registration, sign in with Auth.js to create a browser session too
    await signIn('credentials', { email: values.email, password: values.password, redirect: false })
    router.push('/dashboard')
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
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              placeholder="Priya Sharma"
              autoComplete="name"
              error={errors.name?.message}
              {...register('name')}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="email">Work Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="priya@company.com"
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
              placeholder="Min 8 chars, 1 uppercase, 1 number"
              autoComplete="new-password"
              error={errors.password?.message}
              {...register('password')}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
          </div>

          <Button type="submit" className="w-full" loading={isSubmitting}>
            Create Account
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or sign up with</span>
            </div>
          </div>

          <OAuthButtons callbackUrl="/dashboard" />
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
