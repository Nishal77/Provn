-- Phase 10 — RoleFit AI: Role + StoredFitScore + HireOutcome

-- Enums
CREATE TYPE "RoleDomain" AS ENUM ('CODE', 'DESIGN', 'WRITING', 'DATA', 'MANAGEMENT', 'SALES');

CREATE TYPE "RoleExtractionStatus" AS ENUM ('PENDING', 'EXTRACTING', 'DONE', 'FAILED');

CREATE TYPE "FitDimension" AS ENUM ('CAPABILITY', 'CULTURE', 'GROWTH', 'COMP', 'CAREER');

-- Role
CREATE TABLE "roles" (
  "id"                      TEXT NOT NULL,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL,
  "employerId"              TEXT NOT NULL,
  "title"                   TEXT NOT NULL,
  "descriptionText"         TEXT,
  "domain"                  "RoleDomain" NOT NULL DEFAULT 'CODE',
  "compensationMinUsd"      INTEGER,
  "compensationMaxUsd"      INTEGER,
  "remote"                  BOOLEAN NOT NULL DEFAULT true,
  "location"                TEXT,
  "githubRepoUrl"           TEXT,
  "figmaProjectUrl"         TEXT,
  "extractedRequirements"   JSONB,
  "capabilityVector"        JSONB,
  "pineconeVectorId"        TEXT,
  "extractionStatus"        "RoleExtractionStatus" NOT NULL DEFAULT 'PENDING',
  "blindMode"               BOOLEAN NOT NULL DEFAULT true,
  "active"                  BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- StoredFitScore — cached match between role and candidate
CREATE TABLE "stored_fit_scores" (
  "id"                TEXT NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "roleId"            TEXT NOT NULL,
  "candidateId"       TEXT NOT NULL,
  "overallScore"      INTEGER NOT NULL,
  "capabilityScore"   INTEGER NOT NULL,
  "cultureScore"      INTEGER NOT NULL,
  "growthScore"       INTEGER NOT NULL,
  "compScore"         INTEGER NOT NULL,
  "careerScore"       INTEGER NOT NULL,
  "explainability"    JSONB NOT NULL,
  "blindMode"         BOOLEAN NOT NULL DEFAULT true,
  "employerInterest"  BOOLEAN NOT NULL DEFAULT false,
  "candidateInterest" BOOLEAN NOT NULL DEFAULT false,
  "revealedAt"        TIMESTAMP(3),
  CONSTRAINT "stored_fit_scores_pkey" PRIMARY KEY ("id")
);

-- HireOutcome — feeds RL model
CREATE TABLE "hire_outcomes" (
  "id"                    TEXT NOT NULL,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "roleId"                TEXT NOT NULL,
  "candidateId"           TEXT NOT NULL,
  "hired"                 BOOLEAN NOT NULL,
  "daysToHire"            INTEGER,
  "performanceRating90d"  DECIMAL(3,2),
  "tenureMonths"          INTEGER,
  "fitScoreId"            TEXT,
  CONSTRAINT "hire_outcomes_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
ALTER TABLE "stored_fit_scores" ADD CONSTRAINT "stored_fit_scores_roleId_candidateId_key" UNIQUE ("roleId", "candidateId");

-- FK constraints
ALTER TABLE "stored_fit_scores" ADD CONSTRAINT "stored_fit_scores_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stored_fit_scores" ADD CONSTRAINT "stored_fit_scores_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hire_outcomes" ADD CONSTRAINT "hire_outcomes_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hire_outcomes" ADD CONSTRAINT "hire_outcomes_fitScoreId_fkey"
  FOREIGN KEY ("fitScoreId") REFERENCES "stored_fit_scores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "roles_employerId_idx"  ON "roles"("employerId");
CREATE INDEX "roles_active_idx"      ON "roles"("active");
CREATE INDEX "stored_fit_scores_roleId_idx"      ON "stored_fit_scores"("roleId");
CREATE INDEX "stored_fit_scores_candidateId_idx" ON "stored_fit_scores"("candidateId");
CREATE INDEX "stored_fit_scores_overallScore_idx" ON "stored_fit_scores"("overallScore" DESC);
CREATE INDEX "hire_outcomes_roleId_idx" ON "hire_outcomes"("roleId");
