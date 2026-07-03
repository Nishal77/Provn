-- Phase 1 + 2: Initial schema
-- Creates core identity tables, auth tables, profile

CREATE TYPE "VerificationTier" AS ENUM (
  'T1_GOVERNMENT',
  'T2_EMPLOYER',
  'T3_INSTITUTION',
  'T4_PEER',
  'T5_AI_INFERRED',
  'T6_SELF'
);

CREATE TYPE "AuthProvider" AS ENUM (
  'EMAIL',
  'GOOGLE',
  'GITHUB',
  'SIWE'
);

CREATE TABLE "users" (
  "id"             TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  "email"          TEXT,
  "emailVerified"  TIMESTAMP(3),
  "did"            TEXT,
  "polygonAddress" TEXT,
  "kycTier"        "VerificationTier" NOT NULL DEFAULT 'T6_SELF',
  "name"           TEXT,
  "imageUrl"       TEXT,

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key"          ON "users"("email");
CREATE UNIQUE INDEX "users_did_key"            ON "users"("did");
CREATE UNIQUE INDEX "users_polygonAddress_key" ON "users"("polygonAddress");

CREATE TABLE "accounts" (
  "id"                TEXT NOT NULL,
  "userId"            TEXT NOT NULL,
  "type"              TEXT NOT NULL,
  "provider"          "AuthProvider" NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "accessToken"       TEXT,
  "refreshToken"      TEXT,
  "expiresAt"         INTEGER,
  "tokenType"         TEXT,
  "scope"             TEXT,
  "idToken"           TEXT,
  "sessionState"      TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,

  CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key"
  ON "accounts"("provider", "providerAccountId");
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

ALTER TABLE "accounts"
  ADD CONSTRAINT "accounts_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sessions" (
  "id"           TEXT NOT NULL,
  "sessionToken" TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "expires"      TIMESTAMP(3) NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "verification_tokens" (
  "identifier" TEXT NOT NULL,
  "token"      TEXT NOT NULL,
  "expires"    TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "verification_tokens_token_key"
  ON "verification_tokens"("token");
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key"
  ON "verification_tokens"("identifier", "token");

CREATE TABLE "refresh_tokens" (
  "id"            TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"     TIMESTAMP(3) NOT NULL,
  "userId"        TEXT NOT NULL,
  "tokenHash"     TEXT NOT NULL,
  "revokedAt"     TIMESTAMP(3),
  "revokedReason" TEXT,
  "userAgent"     TEXT,
  "ipAddress"     TEXT,

  CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

ALTER TABLE "refresh_tokens"
  ADD CONSTRAINT "refresh_tokens_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "profiles" (
  "id"                TEXT NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  "userId"            TEXT NOT NULL,
  "headline"          TEXT,
  "bio"               TEXT,
  "location"          TEXT,
  "timezone"          TEXT,
  "websiteUrl"        TEXT,
  "githubUsername"    TEXT,
  "linkedinUrl"       TEXT,
  "completenessScore" INTEGER NOT NULL DEFAULT 0,
  "overallTrustScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "ipfsCid"           TEXT,
  "ipfsUpdatedAt"     TIMESTAMP(3),
  "isPublic"          BOOLEAN NOT NULL DEFAULT true,
  "isSearchable"      BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "profiles_userId_key" ON "profiles"("userId");

ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
