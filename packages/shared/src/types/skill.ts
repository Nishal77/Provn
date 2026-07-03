export type SkillArtifactType = 'GITHUB_REPO' | 'GIST' | 'URL' | 'TEXT'

export type SkillAttestationStatus =
  | 'PENDING'
  | 'EVALUATING'
  | 'SCORED'
  | 'ANCHORING'
  | 'ANCHORED'
  | 'FAILED'

export interface SkillAttestation {
  id: string
  createdAt: string
  updatedAt: string
  userId: string
  skillSlug: string
  skillLevel: number | null
  artifactUrl: string | null
  artifactType: SkillArtifactType
  evidenceCid: string | null
  aiEvalScore: number | null
  aiEvalReport: SkillEvalReport | null
  plagiarismScore: number | null
  chainTxHash: string | null
  chainAnchoredAt: string | null
  status: SkillAttestationStatus
}

export interface SkillEvalReport {
  overall_score: number       // 0–100
  skill_level: number         // 1–10
  categories: {
    code_quality: number
    best_practices: number
    complexity_handling: number
    readability: number
    correctness: number
  }
  reasoning: string
  plagiarism_score: number    // 0.0–1.0
  model_used: string
  eval_duration_ms: number
}

export interface SubmitSkillInput {
  skillSlug: string
  artifactUrl?: string
  artifactType: SkillArtifactType
  description?: string
}

export const SKILL_STATUS_LABELS: Record<SkillAttestationStatus, string> = {
  PENDING: 'Queued',
  EVALUATING: 'Evaluating',
  SCORED: 'Scored',
  ANCHORING: 'Anchoring',
  ANCHORED: 'Verified',
  FAILED: 'Failed',
}

export const SKILL_STATUS_COLORS: Record<SkillAttestationStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  EVALUATING: 'bg-blue-100 text-blue-700',
  SCORED: 'bg-yellow-100 text-yellow-700',
  ANCHORING: 'bg-purple-100 text-purple-700',
  ANCHORED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-600',
}

export const SKILL_SLUGS = [
  'typescript', 'javascript', 'python', 'rust', 'go', 'java', 'csharp', 'cpp',
  'react', 'nextjs', 'vue', 'angular', 'svelte',
  'node', 'fastify', 'express', 'nestjs', 'fastapi', 'django',
  'postgresql', 'mongodb', 'redis', 'elasticsearch',
  'aws', 'gcp', 'azure', 'kubernetes', 'docker', 'terraform',
  'solidity', 'blockchain', 'machine-learning', 'system-design',
  'data-engineering', 'devops', 'security',
] as const

export type SkillSlug = typeof SKILL_SLUGS[number]
