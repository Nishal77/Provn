export const didService = {
  /**
   * Generate a W3C-compliant `did:polygon` identifier from a wallet address.
   * This is the canonical DID method per PRD spec.
   * Format: `did:polygon:{walletAddress}`
   */
  generateFromWallet(walletAddress: string): string {
    const addr = walletAddress.toLowerCase().startsWith('0x')
      ? walletAddress.toLowerCase()
      : `0x${walletAddress.toLowerCase()}`
    return `did:polygon:${addr}`
  },

  /**
   * Generate a temporary `did:attesta` DID for users without a wallet yet.
   * Migrated to did:polygon once KYC + wallet assignment completes.
   */
  generateFromUserId(userId: string): string {
    return `did:attesta:${userId}`
  },

  /**
   * Resolve the best DID for a user: did:polygon if wallet present, else did:attesta.
   */
  resolveForUser(userId: string, polygonAddress: string | null | undefined): string {
    if (polygonAddress) {
      return this.generateFromWallet(polygonAddress)
    }
    return this.generateFromUserId(userId)
  },

  /**
   * Extract wallet address from a `did:polygon` DID.
   */
  parseWalletAddress(did: string): string | null {
    const match = /^did:polygon:(0x[a-f0-9]{40})$/i.exec(did)
    return match?.[1] ?? null
  },

  /**
   * Extract user ID from a legacy `did:attesta` DID.
   */
  parseUserId(did: string): string | null {
    const match = /^did:attesta:(.+)$/.exec(did)
    return match?.[1] ?? null
  },

  isValid(did: string): boolean {
    return /^did:(attesta|polygon):.+$/.test(did)
  },

  isPolygonDID(did: string): boolean {
    return /^did:polygon:0x[a-f0-9]{40}$/i.test(did)
  },
}
