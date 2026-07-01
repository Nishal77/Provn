/**
 * DID (Decentralized Identifier) generation for Phase 2.
 *
 * Phase 2: `did:attesta:{userId}` — local DID, not yet anchored on-chain.
 * Phase 3: Migrated to `did:polygon:{walletAddress}` anchored on Polygon PoS.
 *
 * The `did:attesta` method is a temporary placeholder that gives users a
 * portable identity string immediately after signup, before KYC and blockchain
 * anchoring are complete. Any Phase 2 attestations reference this DID and will
 * be migrated automatically when Phase 3 anchoring runs.
 */

export const didService = {
  /**
   * Generate a Phase 2 `did:attesta` identifier from a user ID.
   * Format: `did:attesta:{userId}`
   *
   * Example: `did:attesta:cm5x3n2kg0000p8r0abc12def`
   */
  generateFromUserId(userId: string): string {
    return `did:attesta:${userId}`
  },

  /**
   * Extract the user ID from a `did:attesta` DID.
   * Returns null for unrecognised formats (Phase 3 Polygon DIDs, etc.).
   */
  parseUserId(did: string): string | null {
    const match = /^did:attesta:(.+)$/.exec(did)
    return match?.[1] ?? null
  },

  /**
   * Check if a string is a valid ATTESTA DID (either Phase 2 or Phase 3 format).
   */
  isValid(did: string): boolean {
    return /^did:(attesta|polygon):.+$/.test(did)
  },
}
