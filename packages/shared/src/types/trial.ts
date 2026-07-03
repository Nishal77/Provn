export type TrialDomain = 'CODE' | 'DESIGN' | 'WRITING' | 'DATA'

export type TrialStatus =
  | 'DRAFT'
  | 'INVITED'
  | 'LEGAL_PENDING'
  | 'READY'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'EVALUATING'
  | 'SCORED'
  | 'CANCELLED'
  | 'EXPIRED'

export type TrialScoreDimension =
  | 'CAPABILITY'
  | 'QUALITY'
  | 'SPEED'
  | 'COMMUNICATION'
  | 'CULTURE'

export interface Trial {
  id: string
  createdAt: string
  updatedAt: string
  employerId: string
  candidateId: string
  domain: TrialDomain
  roleTitle: string
  briefMarkdown?: string
  durationMinutes: number
  compensationCandidateUsd: number
  compensationEmployerUsd: number
  status: TrialStatus
  invitedAt?: string
  startedAt?: string
  submittedAt?: string
  expiresAt?: string
  sandboxSessionUrl?: string
  keystrokeEntropyScore?: number
  pasteEventCount: number
  antiCheatFlags?: Record<string, unknown>
  stripeCandidateTransferId?: string
  candidatePaidAt?: string
  scores?: TrialScore[]
  legal?: TrialLegal
}

export interface TrialScore {
  id: string
  trialId: string
  dimension: TrialScoreDimension
  score: number
  percentile?: number
  reasoning?: string
}

export interface TrialLegal {
  id: string
  trialId: string
  wptaDocumentCid?: string
  jurisdiction: string
  employerSignature?: string
  employerSignedAt?: string
  candidateSignature?: string
  candidateSignedAt?: string
  docusignEnvelopeId?: string
}

export interface TrialEvalReport {
  overallScore: number
  dimensions: Record<TrialScoreDimension, { score: number; percentile: number; reasoning: string }>
  aiModel: string
  evaluatedAt: string
}

export const TRIAL_DOMAIN_LABELS: Record<TrialDomain, string> = {
  CODE: 'Software Engineering',
  DESIGN: 'Product Design',
  WRITING: 'Content / Writing',
  DATA: 'Data Science',
}

export const TRIAL_STATUS_LABELS: Record<TrialStatus, string> = {
  DRAFT: 'Draft',
  INVITED: 'Invite Sent',
  LEGAL_PENDING: 'Awaiting Signature',
  READY: 'Ready to Start',
  IN_PROGRESS: 'In Progress',
  SUBMITTED: 'Submitted',
  EVALUATING: 'Evaluating',
  SCORED: 'Complete',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
}

export const TRIAL_STATUS_COLORS: Record<TrialStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  INVITED: 'bg-blue-100 text-blue-700',
  LEGAL_PENDING: 'bg-yellow-100 text-yellow-700',
  READY: 'bg-indigo-100 text-indigo-700',
  IN_PROGRESS: 'bg-purple-100 text-purple-700',
  SUBMITTED: 'bg-orange-100 text-orange-700',
  EVALUATING: 'bg-amber-100 text-amber-700',
  SCORED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
  EXPIRED: 'bg-gray-100 text-gray-400',
}
