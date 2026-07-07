-- Phase 3: Migrate KYC provider from Onfido to Veriff
--
-- Onfido stored two fields (applicantId + checkId).
-- Veriff only needs one (sessionId) as the single reconciliation key.
-- vendorData in Veriff webhook = userId, so no secondary lookup field needed.

ALTER TABLE "users"
  ADD COLUMN "veriffSessionId" TEXT;

-- Drop Onfido-specific columns (data is no longer needed)
ALTER TABLE "users"
  DROP COLUMN IF EXISTS "onfidoApplicantId",
  DROP COLUMN IF EXISTS "onfidoCheckId";

-- kycStatus values remain the same: NONE | PENDING | APPROVED | REJECTED
