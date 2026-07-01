import type { Metadata } from 'next'
import { SignupForm } from '../../../components/auth/signup-form'

export const metadata: Metadata = { title: 'Create Account' }

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground">Create your account</h1>
          <p className="mt-2 text-muted-foreground">
            Start building your verified professional reputation
          </p>
        </div>
        <SignupForm />
      </div>
    </div>
  )
}
