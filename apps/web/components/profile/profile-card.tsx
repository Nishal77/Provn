import { Card, CardContent, CardHeader } from '@attesta/ui'
import { TrustBadge } from './trust-badge'
import { CompletenessBar } from './completeness-bar'
import type { VerificationTier } from '@attesta/shared'

interface ProfileCardProps {
  name: string | null
  imageUrl?: string | null
  headline?: string | null
  bio?: string | null
  location?: string | null
  kycTier: VerificationTier
  did: string | null
  completenessScore?: number
  showCompleteness?: boolean
}

export function ProfileCard({
  name,
  imageUrl,
  headline,
  bio,
  location,
  kycTier,
  did,
  completenessScore,
  showCompleteness = false,
}: ProfileCardProps) {
  const shortDid = did ? `${did.slice(0, 20)}...` : null

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt={name ?? 'Avatar'} className="h-16 w-16 rounded-full object-cover" />
            ) : (
              (name?.[0] ?? '?').toUpperCase()
            )}
          </div>

          <div className="flex-1 space-y-1">
            <h2 className="text-xl font-bold text-foreground">{name ?? 'Anonymous'}</h2>
            {headline && <p className="text-sm text-muted-foreground">{headline}</p>}
            {location && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {location}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <TrustBadge tier={kycTier} size="sm" />
          {shortDid && (
            <span className="font-mono text-xs text-muted-foreground/60">{shortDid}</span>
          )}
        </div>
      </CardHeader>

      {(bio ?? (showCompleteness && completenessScore !== undefined)) && (
        <CardContent className="space-y-3">
          {bio && <p className="text-sm text-muted-foreground">{bio}</p>}
          {showCompleteness && completenessScore !== undefined && (
            <CompletenessBar score={completenessScore} />
          )}
        </CardContent>
      )}
    </Card>
  )
}
