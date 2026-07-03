export type RoleDomain = 'CODE' | 'DESIGN' | 'WRITING' | 'DATA' | 'MANAGEMENT' | 'SALES'

export type RoleExtractionStatus = 'PENDING' | 'EXTRACTING' | 'DONE' | 'FAILED'

export interface Role {
  id: string
  createdAt: string
  updatedAt: string
  employerId: string
  title: string
  descriptionText?: string
  domain: RoleDomain
  compensationMinUsd?: number
  compensationMaxUsd?: number
  remote: boolean
  location?: string
  githubRepoUrl?: string
  figmaProjectUrl?: string
  extractedRequirements?: ExtractedRequirements
  extractionStatus: RoleExtractionStatus
  blindMode: boolean
  active: boolean
}

export interface ExtractedRequirements {
  languages: string[]
  frameworks: string[]
  tools: string[]
  patterns: string[]
  seniorityLevel: 'junior' | 'mid' | 'senior' | 'staff' | 'principal'
  complexityScore: number   // 0-100
  testCoverage: boolean
  ciCdPresent: boolean
  rawSummary: string
}

export interface StoredFitScore {
  id: string
  createdAt: string
  roleId: string
  candidateId: string
  overallScore: number
  capabilityScore: number
  cultureScore: number
  growthScore: number
  compScore: number
  careerScore: number
  explainability: FitScoreExplainability
  blindMode: boolean
  employerInterest: boolean
  candidateInterest: boolean
  revealedAt?: string
  // populated only after blind mode lifted
  candidateProfile?: AnonymizedCandidate
}

export interface FitScoreExplainability {
  topFactors: Array<{ feature: string; impact: number; direction: 'positive' | 'negative' }>
  dimensionBreakdown: Record<string, { score: number; weight: number; contribution: number }>
  shapValues?: Record<string, number>
}

export interface AnonymizedCandidate {
  // All PII stripped in blind mode — only revealed post mutual interest
  initials?: string
  yearsExperience?: number
  topSkills: string[]
  kycTier: string
  trustScore?: number
  trialScore?: number
  did?: string  // only after reveal
  name?: string // only after reveal
}

export interface HireOutcome {
  id: string
  roleId: string
  candidateId: string
  hired: boolean
  daysToHire?: number
  performanceRating90d?: number
  tenureMonths?: number
  fitScoreId?: string
}

export interface CompensationIntel {
  role: string
  level: string
  geography: string
  p25Usd: number
  p50Usd: number
  p75Usd: number
  p90Usd: number
  sampleSize: number
  updatedAt: string
}

export const ROLE_DOMAIN_LABELS: Record<RoleDomain, string> = {
  CODE: 'Software Engineering',
  DESIGN: 'Product Design',
  WRITING: 'Content / Writing',
  DATA: 'Data Science',
  MANAGEMENT: 'Engineering Management',
  SALES: 'Sales / GTM',
}

// FitScore dimension weights (must sum to 1.0)
export const FIT_DIMENSION_WEIGHTS = {
  CAPABILITY: 0.35,
  CULTURE:    0.20,
  GROWTH:     0.20,
  COMP:       0.15,
  CAREER:     0.10,
} as const
