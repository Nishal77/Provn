import type { VerificationTier } from './user'

/** Auth providers supported by ATTESTA */
export enum AuthProvider {
  EMAIL = 'EMAIL',
  GOOGLE = 'GOOGLE',
  GITHUB = 'GITHUB',
  SIWE = 'SIWE', // Sign-In With Ethereum — any EVM wallet
}

/**
 * JWT access token payload.
 * Lives 15 minutes. Stored in memory (not localStorage — XSS risk).
 * Sent as Bearer header on every API request.
 */
export interface JwtAccessPayload {
  sub: string // User ID (cuid2)
  did: string | null // Decentralized ID — null until Phase 3 KYC
  tier: VerificationTier // Current verification tier
  iat: number // Issued-at Unix seconds
  exp: number // Expires Unix seconds (iat + 15 min)
}

/**
 * JWT refresh token payload.
 * Lives 30 days. Stored in httpOnly secure cookie only.
 * jti is stored in Redis — deleting from Redis instantly revokes the token.
 */
export interface JwtRefreshPayload {
  sub: string // User ID
  jti: string // Unique token ID (stored in Redis for revocation)
  iat: number
  exp: number // iat + 30 days
}

/** Shape of the auth response body (refresh token delivered via cookie) */
export interface AuthResponse {
  accessToken: string
  user: UserPublicAuth
}

/** User fields included in auth responses */
export interface UserPublicAuth {
  id: string
  email: string | null
  name: string | null
  imageUrl: string | null
  kycTier: VerificationTier
  did: string | null
}

/** SIWE challenge returned to the client before signing */
export interface SiweChallenge {
  nonce: string // Random, stored in Redis with 5-min TTL
  issuedAt: string // ISO 8601
  expiresAt: string // ISO 8601
}

/** Body sent by client to verify a SIWE signature */
export interface SiweVerifyBody {
  message: string // Full EIP-4361 message string
  signature: string // Hex-encoded wallet signature
}
