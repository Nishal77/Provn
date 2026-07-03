export type ReferralStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'HIRED'
  | 'TRANCHE1_RELEASED'
  | 'TRANCHE2_RELEASED'
  | 'TRANCHE3_RELEASED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'EXPIRED'

export type BountyStatus = 'OPEN' | 'FILLED' | 'CANCELLED' | 'EXPIRED'

export interface TrustEdge {
  id: string
  fromUserId: string
  toUserId: string
  strengthScore: number   // 0.0–1.0
  coEmploymentMonths: number
  sourceType: string
  evidenceTxHash?: string
}

export interface Referral {
  id: string
  createdAt: string
  updatedAt: string
  referrerId: string
  candidateId: string
  roleId: string
  note?: string
  status: ReferralStatus
  contractAddress?: string
  bountyTotalUsd?: number
  tranche1PaidAt?: string
  tranche2PaidAt?: string
  tranche3PaidAt?: string
  hireTimestamp?: string
  txHashTranche1?: string
  txHashTranche2?: string
  txHashTranche3?: string
  antiCollusionScore?: number
}

export interface BountyListing {
  id: string
  createdAt: string
  employerId: string
  roleId: string
  totalBountyUsd: number
  domain: string
  status: BountyStatus
  contractAddress?: string
  expiresAt?: string
  role?: { title: string; domain: string }
}

export interface TrustPath {
  nodes: TrustPathNode[]
  totalStrength: number
  hopCount: number
}

export interface TrustPathNode {
  userId: string
  did?: string
  strengthToNext?: number
  coEmploymentMonths?: number
}

// Tranche schedule: 33% at hire, 33% at 90 days, 34% at 180 days
export const TRANCHE_PERCENTAGES = [33, 33, 34] as const

export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  HIRED: 'Hired',
  TRANCHE1_RELEASED: 'Tranche 1 Paid',
  TRANCHE2_RELEASED: 'Tranche 2 Paid',
  TRANCHE3_RELEASED: 'Tranche 3 Paid',
  COMPLETED: 'Complete',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
}

export const REFERRAL_STATUS_COLORS: Record<ReferralStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  ACCEPTED: 'bg-blue-100 text-blue-700',
  HIRED: 'bg-indigo-100 text-indigo-700',
  TRANCHE1_RELEASED: 'bg-green-100 text-green-700',
  TRANCHE2_RELEASED: 'bg-green-100 text-green-700',
  TRANCHE3_RELEASED: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-600',
  EXPIRED: 'bg-gray-100 text-gray-400',
}
