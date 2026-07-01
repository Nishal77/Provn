/**
 * IPFS service via Pinata.
 * Phase 2: Pins profile JSON snapshots for portability (OpenRep protocol).
 * Gracefully degrades when PINATA_JWT is not configured.
 *
 * WHY IPFS: ProofWork profiles must be portable — if ATTESTA disappears,
 * the user's verified data lives on IPFS and can be read by any OpenRep client.
 */

export type ProfileSnapshot = {
  did: string
  name: string | null
  headline: string | null
  bio: string | null
  location: string | null
  githubUsername: string | null
  trustScore: number
  kycTier: string
  createdAt: string
  // Never include email — PII must not touch IPFS
}

export const ipfsService = {
  /**
   * Pin a profile snapshot to IPFS via Pinata.
   * Returns the IPFS CID on success, null if Pinata is not configured.
   */
  async pinProfile(snapshot: ProfileSnapshot): Promise<string | null> {
    const jwt = process.env.PINATA_JWT
    if (!jwt) {
      // Not an error — Pinata is optional until Phase 8
      return null
    }

    const body = {
      pinataContent: snapshot,
      pinataMetadata: {
        name: `profile-${snapshot.did}`,
        keyvalues: { did: snapshot.did, tier: snapshot.kycTier },
      },
    }

    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Pinata error ${response.status}: ${text}`)
    }

    const data = (await response.json()) as { IpfsHash: string }
    return data.IpfsHash
  },

  /**
   * Unpin a CID from Pinata (e.g., when user updates their profile).
   * Silently succeeds if PINATA_JWT is not configured.
   */
  async unpin(cid: string): Promise<void> {
    const jwt = process.env.PINATA_JWT
    if (!jwt) return

    await fetch(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${jwt}` },
    })
  },

  /** Public IPFS gateway URL for a CID */
  gatewayUrl(cid: string): string {
    return `https://gateway.pinata.cloud/ipfs/${cid}`
  },
}
