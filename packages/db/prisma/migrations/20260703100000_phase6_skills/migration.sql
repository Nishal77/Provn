-- CreateEnum
CREATE TYPE "SkillArtifactType" AS ENUM ('GITHUB_REPO', 'GIST', 'URL', 'TEXT');

-- CreateEnum
CREATE TYPE "SkillAttestationStatus" AS ENUM ('PENDING', 'EVALUATING', 'SCORED', 'ANCHORING', 'ANCHORED', 'FAILED');

-- CreateEnum
CREATE TYPE "SkillEvalJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "skill_attestations" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "skillSlug" TEXT NOT NULL,
    "skillLevel" INTEGER,
    "artifactUrl" TEXT,
    "artifactType" "SkillArtifactType" NOT NULL DEFAULT 'URL',
    "evidenceCid" TEXT,
    "aiEvalScore" DECIMAL(5,2),
    "aiEvalReport" JSONB,
    "plagiarismScore" DECIMAL(4,3),
    "chainTxHash" TEXT,
    "chainAnchoredAt" TIMESTAMP(3),
    "status" "SkillAttestationStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "skill_attestations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_eval_jobs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "attestationId" TEXT NOT NULL,
    "queueJobId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "status" "SkillEvalJobStatus" NOT NULL DEFAULT 'QUEUED',

    CONSTRAINT "skill_eval_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "skill_eval_jobs_attestationId_key" ON "skill_eval_jobs"("attestationId");

-- CreateIndex
CREATE INDEX "skill_attestations_userId_idx" ON "skill_attestations"("userId");

-- CreateIndex
CREATE INDEX "skill_attestations_skillSlug_idx" ON "skill_attestations"("skillSlug");

-- CreateIndex
CREATE INDEX "skill_attestations_status_idx" ON "skill_attestations"("status");

-- CreateIndex
CREATE INDEX "skill_eval_jobs_attestationId_idx" ON "skill_eval_jobs"("attestationId");

-- AddForeignKey
ALTER TABLE "skill_attestations" ADD CONSTRAINT "skill_attestations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_eval_jobs" ADD CONSTRAINT "skill_eval_jobs_attestationId_fkey" FOREIGN KEY ("attestationId") REFERENCES "skill_attestations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
