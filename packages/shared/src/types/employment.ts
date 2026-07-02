// Employment record types — shared between frontend and backend.

export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'FREELANCE'

export type EmploymentRecordStatus =
  | 'PENDING_EMPLOYER'
  | 'SIGNED'
  | 'ANCHORING'
  | 'ANCHORED'
  | 'REJECTED'
  | 'CANCELLED'

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME:   'Full-time',
  PART_TIME:   'Part-time',
  CONTRACT:    'Contract',
  INTERNSHIP:  'Internship',
  FREELANCE:   'Freelance',
}

export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentRecordStatus, string> = {
  PENDING_EMPLOYER: 'Awaiting employer signature',
  SIGNED:           'Signed — anchoring soon',
  ANCHORING:        'Anchoring on Polygon…',
  ANCHORED:         'Verified on-chain (T2)',
  REJECTED:         'Rejected by employer',
  CANCELLED:        'Cancelled',
}

// Tailwind colour classes for status badges
export const EMPLOYMENT_STATUS_COLORS: Record<EmploymentRecordStatus, string> = {
  PENDING_EMPLOYER: 'bg-yellow-100 text-yellow-800',
  SIGNED:           'bg-blue-100 text-blue-800',
  ANCHORING:        'bg-blue-100 text-blue-800',
  ANCHORED:         'bg-green-100 text-green-800',
  REJECTED:         'bg-red-100 text-red-800',
  CANCELLED:        'bg-gray-100 text-gray-500',
}

export interface EmploymentRecord {
  id:             string
  createdAt:      string
  jobTitle:       string
  department:     string | null
  startDate:      string
  endDate:        string | null
  employmentType: EmploymentType
  status:         EmploymentRecordStatus
  chainTxHash:    string | null
  ipfsCid:        string | null
  employer: {
    name:   string
    domain: string
  }
}

export interface CountersignPreview {
  id:                        string
  jobTitle:                  string
  department:                string | null
  startDate:                 string
  endDate:                   string | null
  employmentType:            EmploymentType
  status:                    EmploymentRecordStatus
  candidateSignedAt:         string | null
  countersignTokenExpiresAt: string | null
  candidate: {
    did:     string | null
    profile: { fullName: string | null; avatarUrl: string | null } | null
  }
  employer: { name: string; domain: string }
}
