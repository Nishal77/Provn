-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE');

-- CreateEnum
CREATE TYPE "EmploymentRecordStatus" AS ENUM ('PENDING_EMPLOYER', 'SIGNED', 'ANCHORING', 'ANCHORED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "facetecSessionId" TEXT,
ADD COLUMN     "facetecVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "employment_records" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "candidateId" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "department" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "documentHash" TEXT,
    "candidateSignedAt" TIMESTAMP(3),
    "employerSignedAt" TIMESTAMP(3),
    "ipfsCid" TEXT,
    "chainTxHash" TEXT,
    "chainAnchoredAt" TIMESTAMP(3),
    "status" "EmploymentRecordStatus" NOT NULL DEFAULT 'PENDING_EMPLOYER',
    "countersignToken" TEXT,
    "countersignTokenExpiresAt" TIMESTAMP(3),

    CONSTRAINT "employment_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employment_records_countersignToken_key" ON "employment_records"("countersignToken");

-- CreateIndex
CREATE INDEX "employment_records_candidateId_idx" ON "employment_records"("candidateId");

-- CreateIndex
CREATE INDEX "employment_records_employerId_idx" ON "employment_records"("employerId");

-- CreateIndex
CREATE INDEX "employment_records_status_idx" ON "employment_records"("status");

-- AddForeignKey
ALTER TABLE "employment_records" ADD CONSTRAINT "employment_records_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_records" ADD CONSTRAINT "employment_records_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "employers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

