-- Phase 12: University Issuers + OpenRep Issuer Registry

-- University/Issuer table
CREATE TABLE "UniversityIssuer" (
    "id"                TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "did"               TEXT NOT NULL,
    "name"              TEXT NOT NULL,
    "domain"            TEXT NOT NULL,
    "countryCode"       TEXT NOT NULL,
    "logoUrl"           TEXT,
    "websiteUrl"        TEXT,
    "issuerApiKey"      TEXT NOT NULL,   -- bcrypt-hashed; used for /protocol/issue
    "status"            TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | ACTIVE | SUSPENDED
    "verifiedAt"        TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UniversityIssuer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UniversityIssuer_did_key"    ON "UniversityIssuer"("did");
CREATE UNIQUE INDEX "UniversityIssuer_domain_key" ON "UniversityIssuer"("domain");
CREATE UNIQUE INDEX "UniversityIssuer_issuerApiKey_key" ON "UniversityIssuer"("issuerApiKey");

-- Issued Credentials log (non-PII — only metadata + chain hashes)
CREATE TABLE "IssuedCredential" (
    "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "issuerId"      TEXT NOT NULL,
    "profileDid"    TEXT NOT NULL,      -- recipient DID
    "credentialType" TEXT NOT NULL,     -- DEGREE | CERTIFICATION | TRANSCRIPT
    "schemaUrl"     TEXT NOT NULL,      -- W3C VC schema URL
    "evidenceCid"   TEXT,               -- IPFS CID of evidence (no PII on-chain)
    "chainTxHash"   TEXT,
    "issuedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt"     TIMESTAMP(3),
    "revokedAt"     TIMESTAMP(3),
    CONSTRAINT "IssuedCredential_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "IssuedCredential_issuerId_fkey"
        FOREIGN KEY ("issuerId") REFERENCES "UniversityIssuer"("id") ON DELETE CASCADE
);

CREATE INDEX "IssuedCredential_issuerId_idx"   ON "IssuedCredential"("issuerId");
CREATE INDEX "IssuedCredential_profileDid_idx" ON "IssuedCredential"("profileDid");

-- Gov integrations stub
CREATE TABLE "GovIntegration" (
    "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "type"          TEXT NOT NULL,  -- INDIA_DPDP | USPTO | STATE_BAR
    "jurisdiction"  TEXT NOT NULL,
    "apiEndpoint"   TEXT,
    "status"        TEXT NOT NULL DEFAULT 'PENDING',
    "lastSyncAt"    TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GovIntegration_pkey" PRIMARY KEY ("id")
);
