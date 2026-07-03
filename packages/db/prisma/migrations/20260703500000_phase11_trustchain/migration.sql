-- Phase 11 — TrustChain Talent: TrustEdge + Referral + Bounty

CREATE TYPE "ReferralStatus" AS ENUM (
  'PENDING',
  'ACCEPTED',
  'HIRED',
  'TRANCHE1_RELEASED',
  'TRANCHE2_RELEASED',
  'TRANCHE3_RELEASED',
  'COMPLETED',
  'REJECTED',
  'EXPIRED'
);

CREATE TYPE "BountyStatus" AS ENUM (
  'OPEN',
  'FILLED',
  'CANCELLED',
  'EXPIRED'
);

-- TrustEdge — directed edge in trust graph (co-employment or endorsement)
CREATE TABLE "trust_edges" (
  "id"                TEXT NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fromUserId"        TEXT NOT NULL,
  "toUserId"          TEXT NOT NULL,
  "strengthScore"     DECIMAL(4,3) NOT NULL DEFAULT 0.5,
  "coEmploymentMonths" INTEGER NOT NULL DEFAULT 0,
  "sourceType"        TEXT NOT NULL DEFAULT 'co_employment',
  "evidenceTxHash"    TEXT,
  CONSTRAINT "trust_edges_pkey" PRIMARY KEY ("id")
);

-- Referral — one referral from referrer to candidate for a role
CREATE TABLE "referrals" (
  "id"                    TEXT NOT NULL,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,
  "referrerId"            TEXT NOT NULL,
  "candidateId"           TEXT NOT NULL,
  "roleId"                TEXT NOT NULL,
  "note"                  TEXT,
  "status"                "ReferralStatus" NOT NULL DEFAULT 'PENDING',
  "contractAddress"       TEXT,
  "bountyTotalUsd"        INTEGER,
  "tranche1PaidAt"        TIMESTAMP(3),
  "tranche2PaidAt"        TIMESTAMP(3),
  "tranche3PaidAt"        TIMESTAMP(3),
  "hireTimestamp"         TIMESTAMP(3),
  "txHashTranche1"        TEXT,
  "txHashTranche2"        TEXT,
  "txHashTranche3"        TEXT,
  "antiCollusionScore"    DECIMAL(4,3),
  CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- BountyListing — open bounty on a role (employer posts, referrers claim)
CREATE TABLE "bounty_listings" (
  "id"                TEXT NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  "employerId"        TEXT NOT NULL,
  "roleId"            TEXT NOT NULL,
  "totalBountyUsd"    INTEGER NOT NULL,
  "domain"            TEXT NOT NULL DEFAULT 'CODE',
  "status"            "BountyStatus" NOT NULL DEFAULT 'OPEN',
  "contractAddress"   TEXT,
  "expiresAt"         TIMESTAMP(3),
  CONSTRAINT "bounty_listings_pkey" PRIMARY KEY ("id")
);

-- Unique: one edge per (from, to) direction
ALTER TABLE "trust_edges" ADD CONSTRAINT "trust_edges_fromUserId_toUserId_key" UNIQUE ("fromUserId", "toUserId");
ALTER TABLE "bounty_listings" ADD CONSTRAINT "bounty_listings_roleId_key" UNIQUE ("roleId");

-- FK
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrerId_fkey"
  FOREIGN KEY ("referrerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bounty_listings" ADD CONSTRAINT "bounty_listings_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "trust_edges_fromUserId_idx" ON "trust_edges"("fromUserId");
CREATE INDEX "trust_edges_toUserId_idx"   ON "trust_edges"("toUserId");
CREATE INDEX "referrals_referrerId_idx"   ON "referrals"("referrerId");
CREATE INDEX "referrals_candidateId_idx"  ON "referrals"("candidateId");
CREATE INDEX "referrals_roleId_idx"       ON "referrals"("roleId");
CREATE INDEX "referrals_status_idx"       ON "referrals"("status");
CREATE INDEX "bounty_listings_status_idx" ON "bounty_listings"("status");
