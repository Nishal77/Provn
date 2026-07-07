/**
 * Verification tier levels for ATTESTA's trust scoring system.
 *
 * Each tier represents a different verification method.
 * Higher tiers carry more weight in trust score calculations.
 *
 * WHY enums: Prisma schema, DB, and API all use these same string values.
 * Sharing from this package ensures they never drift out of sync.
 */
export enum VerificationTier {
  T1_GOVERNMENT = 'T1_GOVERNMENT', // 10/10 — Govt ID via Veriff
  T2_EMPLOYER = 'T2_EMPLOYER', // 9/10  — Employer co-signed on Polygon
  T3_INSTITUTION = 'T3_INSTITUTION', // 8/10  — University / institution
  T4_PEER = 'T4_PEER', // 6/10  — Peer co-attested
  T5_AI_INFERRED = 'T5_AI_INFERRED', // 5/10  — AI evaluation score
  T6_SELF = 'T6_SELF', // 1/10  — Self-reported (default for new users)
}

/** Numeric trust score for each tier — used in FitScore weighted averages */
export const TIER_SCORES: Record<VerificationTier, number> = {
  [VerificationTier.T1_GOVERNMENT]: 10,
  [VerificationTier.T2_EMPLOYER]: 9,
  [VerificationTier.T3_INSTITUTION]: 8,
  [VerificationTier.T4_PEER]: 6,
  [VerificationTier.T5_AI_INFERRED]: 5,
  [VerificationTier.T6_SELF]: 1,
}

/** Public-safe user shape — no PII, safe to embed in JWT claims */
export interface UserPublic {
  id: string
  did: string | null
  name: string | null
  imageUrl: string | null
  kycTier: VerificationTier
  createdAt: Date
}
