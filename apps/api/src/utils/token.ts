import crypto from 'node:crypto'

/** SHA-256 hash a token. Store the hash, never the raw value. */
export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

/** Generate a cryptographically random hex string. */
export function generateSecureToken(byteLength = 64): string {
  return crypto.randomBytes(byteLength).toString('hex')
}

/** Generate a short nonce for SIWE challenges (alphanumeric, 16 chars). */
export function generateNonce(): string {
  return crypto.randomBytes(12).toString('base64url').slice(0, 16)
}
