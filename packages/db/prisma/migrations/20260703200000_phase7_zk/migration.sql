-- CreateEnum
CREATE TYPE "ZKClaimType" AS ENUM ('SALARY_RANGE', 'EMPLOYMENT_DURATION');

-- CreateEnum
CREATE TYPE "ZKDisclosureStatus" AS ENUM ('PENDING_PROOF', 'PROOF_SUBMITTED', 'VERIFIED', 'DECLINED', 'EXPIRED', 'FAILED');

-- CreateTable
CREATE TABLE "zk_disclosure_requests" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "requesterId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "claimType" "ZKClaimType" NOT NULL,
    "claimParams" JSONB NOT NULL,
    "proof" JSONB,
    "proofTxHash" TEXT,
    "proofResult" BOOLEAN,
    "status" "ZKDisclosureStatus" NOT NULL DEFAULT 'PENDING_PROOF',

    CONSTRAINT "zk_disclosure_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "zk_disclosure_requests_candidateId_idx" ON "zk_disclosure_requests"("candidateId");

-- CreateIndex
CREATE INDEX "zk_disclosure_requests_requesterId_idx" ON "zk_disclosure_requests"("requesterId");

-- CreateIndex
CREATE INDEX "zk_disclosure_requests_status_idx" ON "zk_disclosure_requests"("status");
