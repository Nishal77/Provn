import { TIER_LABELS, TIER_SCORES, type VerificationTier } from '@attesta/shared'
import { cn } from '@attesta/ui'

const TIER_STYLES: Record<VerificationTier, string> = {
  T1_GOVERNMENT: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  T2_EMPLOYER: 'bg-blue-100 text-blue-800 border-blue-200',
  T3_INSTITUTION: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  T4_PEER: 'bg-violet-100 text-violet-800 border-violet-200',
  T5_AI_INFERRED: 'bg-amber-100 text-amber-800 border-amber-200',
  T6_SELF: 'bg-slate-100 text-slate-600 border-slate-200',
}

interface TrustBadgeProps {
  tier: VerificationTier
  showScore?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function TrustBadge({ tier, showScore = true, size = 'md', className }: TrustBadgeProps) {
  const label = TIER_LABELS[tier]
  const score = TIER_SCORES[tier]
  const styles = TIER_STYLES[tier]

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        styles,
        sizeClasses[size],
        className
      )}
    >
      <VerifiedIcon tier={tier} />
      {label}
      {showScore && (
        <span className="opacity-60">· {score}/10</span>
      )}
    </span>
  )
}

function VerifiedIcon({ tier }: { tier: VerificationTier }) {
  if (tier === 'T6_SELF') {
    return (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
    )
  }
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
