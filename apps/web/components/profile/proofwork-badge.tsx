import { TIER_LABELS, type VerificationTier } from '@attesta/shared'

interface ProofWorkBadgeProps {
  name: string
  did: string
  tier: VerificationTier
  headline?: string | null
}

/**
 * The ProofWork Badge — shareable embed that proves identity and verification tier.
 * Used on LinkedIn profiles (via Chrome extension) and external sites.
 *
 * Design: dark card with ATTESTA branding + DID + tier badge.
 */
export function ProofWorkBadge({ name, did, tier, headline }: ProofWorkBadgeProps) {
  const shortDid = `${did.slice(0, 18)}...${did.slice(-6)}`

  return (
    <div className="inline-flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 p-4 font-sans">
      <div className="flex items-center gap-2">
        {/* ATTESTA wordmark */}
        <span className="text-xs font-bold tracking-widest text-primary/60 uppercase">
          ATTESTA
        </span>
        <span className="text-xs text-muted-foreground">ProofWork™</span>
      </div>

      <div>
        <p className="font-semibold text-foreground">{name}</p>
        {headline && <p className="text-sm text-muted-foreground">{headline}</p>}
      </div>

      <div className="flex items-center gap-2">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {TIER_LABELS[tier]}
        </span>
        <span className="font-mono text-xs text-muted-foreground">{shortDid}</span>
      </div>

      <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
        <svg className="h-3 w-3 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Cryptographically verified · attesta.io
      </div>
    </div>
  )
}
