-- Phase 3: Add FaceTec 3D liveness fields to users table.
-- FaceTec (ISO 30107-3) runs as Step 1 of KYC — before the Onfido doc check.
-- facetecVerifiedAt is the gate that unblocks POST /kyc/initiate.
-- No PII is stored — only the session ID (a UUID from FaceTec) and timestamp.

ALTER TABLE "users"
  ADD COLUMN "facetecSessionId"  TEXT,
  ADD COLUMN "facetecVerifiedAt" TIMESTAMP(3);
