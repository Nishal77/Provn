-- Phase 3: KYC + DID On-Chain
--
-- Adds fields needed for:
--   1. Onfido government ID verification lifecycle (applicant ID, check ID, status)
--   2. DID anchoring on Polygon (chainTxHash, did on profile)
--
-- kycStatus tracks the Onfido check state:
--   NONE      — never initiated
--   PENDING   — Onfido check in progress (SDK submitted, waiting for webhook)
--   APPROVED  — check passed, T1 tier granted
--   REJECTED  — check failed (document invalid or liveness failed)

ALTER TABLE "users"
  ADD COLUMN "kycStatus"         TEXT DEFAULT 'NONE',
  ADD COLUMN "onfidoApplicantId" TEXT,
  ADD COLUMN "onfidoCheckId"     TEXT;

ALTER TABLE "profiles"
  ADD COLUMN "did"         TEXT,
  ADD COLUMN "chainTxHash" TEXT;
