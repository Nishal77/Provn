import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ProfileCard } from '@/components/profile/profile-card'
import { ProofWorkBadge } from '@/components/profile/proofwork-badge'
import type { VerificationTier } from '@attesta/shared'

interface PublicProfile {
  name: string | null
  headline: string | null
  bio: string | null
  location: string | null
  did: string
  kycTier: VerificationTier
  overallTrustScore: number
  completenessScore: number
  linkedinUrl: string | null
  websiteUrl: string | null
  githubConnected: boolean
}

async function fetchPublicProfile(did: string): Promise<PublicProfile | null> {
  const apiUrl = process.env.INTERNAL_API_URL ?? 'http://localhost:4000'

  try {
    const res = await fetch(`${apiUrl}/profile/proof/${encodeURIComponent(did)}`, {
      next: { revalidate: 60 }, // Cache for 60 seconds, then revalidate
    })

    if (!res.ok) return null

    const json = await res.json() as { success: boolean; data?: PublicProfile }
    if (!json.success || !json.data) return null

    return json.data
  } catch {
    return null
  }
}

// Generate the page title and Open Graph tags from the profile data
export async function generateMetadata({
  params,
}: {
  params: { did: string }
}): Promise<Metadata> {
  const profile = await fetchPublicProfile(params.did)

  if (!profile) {
    return { title: 'Profile Not Found — ATTESTA' }
  }

  const name = profile.name ?? 'Anonymous'
  const description = profile.headline ?? profile.bio ?? 'Verified professional profile on ATTESTA'

  return {
    title: `${name} — ProofWork Profile`,
    description,
    openGraph: {
      title: `${name} on ATTESTA`,
      description,
      type: 'profile',
    },
  }
}

export default async function PublicProfilePage({
  params,
}: {
  params: { did: string }
}) {
  const profile = await fetchPublicProfile(params.did)

  if (!profile) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <span className="font-bold text-primary">ATTESTA</span>
          <span className="text-xs text-muted-foreground">Verified Professional Identity</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        {/* Main profile card */}
        <ProfileCard
          name={profile.name}
          headline={profile.headline}
          bio={profile.bio}
          location={profile.location}
          kycTier={profile.kycTier}
          did={profile.did}
        />

        {/* Links row */}
        {(profile.linkedinUrl ?? profile.websiteUrl ?? profile.githubConnected) && (
          <div className="flex flex-wrap gap-3">
            {profile.githubConnected && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                </svg>
                GitHub Connected
              </span>
            )}
            {profile.linkedinUrl && (
              <a
                href={profile.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300"
              >
                LinkedIn
              </a>
            )}
            {profile.websiteUrl && (
              <a
                href={profile.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium hover:bg-muted/80"
              >
                Website
              </a>
            )}
          </div>
        )}

        {/* Shareable ProofWork badge */}
        <ProofWorkBadge
          name={profile.name ?? ''}
          headline={profile.headline}
          did={profile.did}
          tier={profile.kycTier}
        />

        {/* Verification call-to-action for visitors */}
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Want your own verified professional identity?{' '}
            <a href="/signup" className="font-medium text-primary hover:underline">
              Join ATTESTA for free
            </a>
          </p>
        </div>
      </main>
    </div>
  )
}
