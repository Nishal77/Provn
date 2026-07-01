import { VerificationTier } from '../types/user'

/** Human-readable label for each verification tier */
export const TIER_LABELS: Record<VerificationTier, string> = {
  [VerificationTier.T1_GOVERNMENT]: 'Government Verified',
  [VerificationTier.T2_EMPLOYER]: 'Employer Verified',
  [VerificationTier.T3_INSTITUTION]: 'Institution Verified',
  [VerificationTier.T4_PEER]: 'Peer Attested',
  [VerificationTier.T5_AI_INFERRED]: 'AI Evaluated',
  [VerificationTier.T6_SELF]: 'Self-Reported',
}

/** Badge color for each tier (Tailwind class suffix) */
export const TIER_COLORS: Record<VerificationTier, string> = {
  [VerificationTier.T1_GOVERNMENT]: 'emerald',
  [VerificationTier.T2_EMPLOYER]: 'blue',
  [VerificationTier.T3_INSTITUTION]: 'indigo',
  [VerificationTier.T4_PEER]: 'violet',
  [VerificationTier.T5_AI_INFERRED]: 'amber',
  [VerificationTier.T6_SELF]: 'slate',
}
