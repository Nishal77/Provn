import { auth } from '../../../auth'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@attesta/ui'
import { db } from '@attesta/db'
import { TIER_LABELS } from '@attesta/shared'
import type { VerificationTier } from '@attesta/shared'
import { DashboardHeader } from '../../../components/dashboard/header'

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  // Load profile data on the server — no loading spinners for initial render
  const profile = await db.profile.findUnique({
    where: { userId: session.user.id },
    select: {
      completenessScore: true,
      overallTrustScore: true,
      headline: true,
    },
  })

  const tierLabel = TIER_LABELS[session.user.kycTier as VerificationTier] ?? 'Self-Reported'

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={session.user} />

      <main className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-bold text-foreground">
          Welcome back, {session.user.name?.split(' ')[0] ?? 'there'} 👋
        </h1>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Trust Score */}
          <Card>
            <CardHeader>
              <CardDescription>Trust Score</CardDescription>
              <CardTitle className="text-4xl font-bold text-primary">
                {Number(profile?.overallTrustScore ?? 0).toFixed(1)}
                <span className="text-lg font-normal text-muted-foreground">/10</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Verification level: {tierLabel}</p>
            </CardContent>
          </Card>

          {/* Profile Completeness */}
          <Card>
            <CardHeader>
              <CardDescription>Profile Completeness</CardDescription>
              <CardTitle className="text-4xl font-bold text-primary">
                {profile?.completenessScore ?? 0}
                <span className="text-lg font-normal text-muted-foreground">%</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {(profile?.completenessScore ?? 0) < 100
                  ? 'Add more verifications to increase your score'
                  : 'Profile complete!'}
              </p>
            </CardContent>
          </Card>

          {/* Wallet Status */}
          <Card>
            <CardHeader>
              <CardDescription>Polygon Wallet</CardDescription>
              <CardTitle className="text-sm font-mono">
                {session.user.polygonAddress
                  ? `${session.user.polygonAddress.slice(0, 6)}...${session.user.polygonAddress.slice(-4)}`
                  : 'Not connected'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {session.user.did ? `DID: ${session.user.did.slice(0, 20)}...` : 'DID pending KYC'}
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
