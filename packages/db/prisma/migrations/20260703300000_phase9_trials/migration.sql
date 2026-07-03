-- Phase 9 — WorkProof Live: Trial + TrialScore + TrialLegal

-- Enums
CREATE TYPE "TrialDomain" AS ENUM ('CODE', 'DESIGN', 'WRITING', 'DATA');

CREATE TYPE "TrialStatus" AS ENUM (
  'DRAFT',
  'INVITED',
  'LEGAL_PENDING',
  'READY',
  'IN_PROGRESS',
  'SUBMITTED',
  'EVALUATING',
  'SCORED',
  'CANCELLED',
  'EXPIRED'
);

CREATE TYPE "TrialScoreDimension" AS ENUM (
  'CAPABILITY',
  'QUALITY',
  'SPEED',
  'COMMUNICATION',
  'CULTURE'
);

-- Trial
CREATE TABLE "trials" (
  "id"                    TEXT NOT NULL,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,
  "employerId"            TEXT NOT NULL,
  "candidateId"           TEXT NOT NULL,
  "domain"                "TrialDomain" NOT NULL DEFAULT 'CODE',
  "roleTitle"             TEXT NOT NULL,
  "briefMarkdown"         TEXT,
  "durationMinutes"       INTEGER NOT NULL DEFAULT 120,
  "compensationCandidateUsd" INTEGER NOT NULL DEFAULT 100,
  "compensationEmployerUsd"  INTEGER NOT NULL DEFAULT 300,
  "status"                "TrialStatus" NOT NULL DEFAULT 'DRAFT',
  "invitedAt"             TIMESTAMP(3),
  "startedAt"             TIMESTAMP(3),
  "submittedAt"           TIMESTAMP(3),
  "expiresAt"             TIMESTAMP(3),
  "sandboxContainerId"    TEXT,
  "sandboxSessionUrl"     TEXT,
  "recordingS3Key"        TEXT,
  "keystrokeEntropyScore" DECIMAL(5,3),
  "pasteEventCount"       INTEGER NOT NULL DEFAULT 0,
  "antiCheatFlags"        JSONB,
  "stripePaymentIntentId" TEXT,
  "stripeCandidateTransferId" TEXT,
  "candidatePaidAt"       TIMESTAMP(3),
  CONSTRAINT "trials_pkey" PRIMARY KEY ("id")
);

-- TrialScore
CREATE TABLE "trial_scores" (
  "id"          TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "trialId"     TEXT NOT NULL,
  "dimension"   "TrialScoreDimension" NOT NULL,
  "score"       INTEGER NOT NULL,
  "percentile"  DECIMAL(5,2),
  "reasoning"   TEXT,
  CONSTRAINT "trial_scores_pkey" PRIMARY KEY ("id")
);

-- TrialLegal
CREATE TABLE "trial_legal" (
  "id"                  TEXT NOT NULL,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "trialId"             TEXT NOT NULL,
  "wptaDocumentCid"     TEXT,
  "jurisdiction"        TEXT NOT NULL DEFAULT 'US',
  "employerSignature"   TEXT,
  "employerSignedAt"    TIMESTAMP(3),
  "candidateSignature"  TEXT,
  "candidateSignedAt"   TIMESTAMP(3),
  "docusignEnvelopeId"  TEXT,
  CONSTRAINT "trial_legal_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
ALTER TABLE "trial_scores" ADD CONSTRAINT "trial_scores_trialId_dimension_key" UNIQUE ("trialId", "dimension");
ALTER TABLE "trial_legal"  ADD CONSTRAINT "trial_legal_trialId_key" UNIQUE ("trialId");

-- FK constraints
ALTER TABLE "trials" ADD CONSTRAINT "trials_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "trial_scores" ADD CONSTRAINT "trial_scores_trialId_fkey"
  FOREIGN KEY ("trialId") REFERENCES "trials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "trial_legal" ADD CONSTRAINT "trial_legal_trialId_fkey"
  FOREIGN KEY ("trialId") REFERENCES "trials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "trials_candidateId_idx" ON "trials"("candidateId");
CREATE INDEX "trials_employerId_idx"  ON "trials"("employerId");
CREATE INDEX "trials_status_idx"      ON "trials"("status");
CREATE INDEX "trial_scores_trialId_idx" ON "trial_scores"("trialId");
