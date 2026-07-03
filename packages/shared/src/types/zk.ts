export type ZKClaimType = 'SALARY_RANGE' | 'EMPLOYMENT_DURATION'

export type ZKDisclosureStatus =
  | 'PENDING_PROOF'
  | 'PROOF_SUBMITTED'
  | 'VERIFIED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'FAILED'

export interface SalaryRangeParams {
  minSalary: number  // USD, whole dollars
  maxSalary: number
}

export interface EmploymentDurationParams {
  minMonths: number
}

export type ZKClaimParams = SalaryRangeParams | EmploymentDurationParams

export interface Groth16Proof {
  pi_a: [string, string, string]
  pi_b: [[string, string], [string, string], [string, string]]
  pi_c: [string, string, string]
  protocol: 'groth16'
  curve: 'bn128'
}

export interface ZKProofBundle {
  proof: Groth16Proof
  publicSignals: string[]
}

export interface ZKDisclosureRequest {
  id: string
  createdAt: string
  updatedAt: string
  expiresAt: string
  requesterId: string
  candidateId: string
  claimType: ZKClaimType
  claimParams: ZKClaimParams
  proof: ZKProofBundle | null
  proofTxHash: string | null
  proofResult: boolean | null
  status: ZKDisclosureStatus
}

export const ZK_STATUS_LABELS: Record<ZKDisclosureStatus, string> = {
  PENDING_PROOF: 'Awaiting proof',
  PROOF_SUBMITTED: 'Verifying',
  VERIFIED: 'Verified ✓',
  DECLINED: 'Declined',
  EXPIRED: 'Expired',
  FAILED: 'Proof invalid',
}

export const ZK_STATUS_COLORS: Record<ZKDisclosureStatus, string> = {
  PENDING_PROOF: 'bg-yellow-100 text-yellow-700',
  PROOF_SUBMITTED: 'bg-blue-100 text-blue-700',
  VERIFIED: 'bg-green-100 text-green-700',
  DECLINED: 'bg-gray-100 text-gray-500',
  EXPIRED: 'bg-gray-100 text-gray-400',
  FAILED: 'bg-red-100 text-red-600',
}

export function formatClaimLabel(type: ZKClaimType, params: ZKClaimParams): string {
  if (type === 'SALARY_RANGE') {
    const p = params as SalaryRangeParams
    const fmt = (n: number) => `$${(n / 1000).toFixed(0)}K`
    return `Salary ${fmt(p.minSalary)}–${fmt(p.maxSalary)}`
  }
  const p = params as EmploymentDurationParams
  const years = Math.floor(p.minMonths / 12)
  const months = p.minMonths % 12
  const parts = []
  if (years) parts.push(`${years}y`)
  if (months) parts.push(`${months}m`)
  return `Tenure ≥ ${parts.join(' ')}`
}
