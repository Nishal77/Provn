import type { User, Profile, VerificationTier } from '@attesta/db'

// Completeness score weights — must sum to 100
const WEIGHTS = {
  emailVerified: 15, // Email confirmed via OTP or OAuth
  name: 5, // Display name set
  headline: 10, // Professional headline
  bio: 10, // About section
  location: 5, // City/region
  githubConnected: 15, // GitHub username linked
  linkedinUrl: 5, // LinkedIn profile linked
  websiteUrl: 5, // Personal website
  employerVerified: 15, // At least one employer co-signed (T2)
  govtVerified: 15, // Government ID verified (T1)
} as const

type CompletenessInput = {
  user: Pick<User, 'emailVerified' | 'name' | 'kycTier'>
  profile: Pick<Profile, 'headline' | 'bio' | 'location' | 'githubUsername' | 'linkedinUrl' | 'websiteUrl'>
}

export type CompletenessBreakdown = {
  score: number
  items: Array<{ label: string; done: boolean; points: number }>
}

/**
 * Calculate a 0-100 completeness score for a user's ProofWork profile.
 * Each item represents a verifiable piece of information that builds trust.
 */
export function calculateCompleteness(input: CompletenessInput): CompletenessBreakdown {
  const { user, profile } = input
  const tier = user.kycTier as VerificationTier

  const items = [
    {
      label: 'Email verified',
      done: !!user.emailVerified,
      points: WEIGHTS.emailVerified,
    },
    {
      label: 'Name added',
      done: !!user.name?.trim(),
      points: WEIGHTS.name,
    },
    {
      label: 'Professional headline',
      done: !!profile.headline?.trim(),
      points: WEIGHTS.headline,
    },
    {
      label: 'Bio written',
      done: !!profile.bio?.trim(),
      points: WEIGHTS.bio,
    },
    {
      label: 'Location set',
      done: !!profile.location?.trim(),
      points: WEIGHTS.location,
    },
    {
      label: 'GitHub connected',
      done: !!profile.githubUsername?.trim(),
      points: WEIGHTS.githubConnected,
    },
    {
      label: 'LinkedIn linked',
      done: !!profile.linkedinUrl?.trim(),
      points: WEIGHTS.linkedinUrl,
    },
    {
      label: 'Website added',
      done: !!profile.websiteUrl?.trim(),
      points: WEIGHTS.websiteUrl,
    },
    {
      label: 'Employer verified (T2)',
      done: ['T2_EMPLOYER', 'T1_GOVERNMENT'].includes(tier),
      points: WEIGHTS.employerVerified,
    },
    {
      label: 'Government ID verified (T1)',
      done: tier === 'T1_GOVERNMENT',
      points: WEIGHTS.govtVerified,
    },
  ]

  const score = items.filter((i) => i.done).reduce((sum, i) => sum + i.points, 0)

  return { score, items }
}
