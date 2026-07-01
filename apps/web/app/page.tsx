import Link from 'next/link'
import { Button } from '@attesta/ui'
import { auth } from '../auth'
import { redirect } from 'next/navigation'

// Landing page — redirects authenticated users straight to dashboard
export default async function HomePage() {
  const session = await auth()
  if (session) redirect('/dashboard')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h1 className="mb-4 text-5xl font-bold tracking-tight text-foreground">
          The Trust Infrastructure of Professional Work
        </h1>
        <p className="mb-8 text-xl text-muted-foreground">
          Cryptographically verified credentials. Replace resumes, ATS, and interviews.
          Your reputation — portable, fraud-proof, and always yours.
        </p>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button size="lg" asChild>
            <Link href="/signup">Get Started Free</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
