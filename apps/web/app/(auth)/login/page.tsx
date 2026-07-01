import type { Metadata } from 'next'
import { LoginForm } from '../../../components/auth/login-form'

export const metadata: Metadata = { title: 'Sign In' }

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground">Welcome back</h1>
          <p className="mt-2 text-muted-foreground">Sign in to your ATTESTA account</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
