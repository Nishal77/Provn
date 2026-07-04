/**
 * @openrep/sdk — Open protocol for professional trust.
 * MIT-licensed. Reference implementation by ATTESTA Inc.
 *
 * Spec: W3C DID Core 1.0 + VC Data Model 1.1 + ZK Disclosure Protocol
 * Chain: Polygon PoS (did:polygon method)
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DIDDocument {
  '@context': string[]
  id: string                   // did:polygon:{address}
  verificationMethod: VerificationMethod[]
  authentication: string[]
  assertionMethod: string[]
  service?: ServiceEndpoint[]
  // ATTESTA extension
  attestaMetadata?: {
    kycTier: string
    overallTrustScore: number
    credentialCount: number
    lastUpdated: string
  }
}

export interface VerificationMethod {
  id: string
  type: string
  controller: string
  publicKeyMultibase?: string
}

export interface ServiceEndpoint {
  id: string
  type: string
  serviceEndpoint: string
}

export interface VCMetadata {
  id: string
  type: string[]
  issuer: string
  issuanceDate: string
  expirationDate?: string
  credentialSubject: {
    id: string
    [key: string]: unknown
  }
  proof?: { type: string; [key: string]: unknown }
  verificationTier?: string
  onChainTxHash?: string
}

export interface VerifyResult {
  valid: boolean
  vcId?: string
  claimType?: string
  result?: boolean
  verifiedAt: string
  error?: string
}

export interface PublicProfile {
  did: string
  kycTier: string
  overallTrustScore: number
  skills: Array<{ skillSlug: string; skillLevel: number; aiEvalScore: number }>
  employment: Array<{ companyName: string; role: string; verificationTier: string }>
  credentialCount: number
}

export interface Issuer {
  id: string
  name: string
  domain: string
  type: 'employer' | 'university' | 'government' | 'ai_evaluator'
  verificationTier: string
  activeCredentials: number
}

export interface TrustPath {
  found: boolean
  path: string[]   // ordered list of DIDs from source → target
  hopCount: number
  trustScore: number
}

export interface WebhookSubscription {
  subscriptionId: string
  did: string
  callbackUrl: string
  events: CredentialEvent[]
  createdAt: string
}

export type CredentialEvent =
  | 'CREDENTIAL_ISSUED'
  | 'CREDENTIAL_REVOKED'
  | 'KYC_TIER_CHANGED'
  | 'TRUST_SCORE_CHANGED'

export interface CompensationIntel {
  role: string
  level: string
  geography: string
  p25Usd: number
  p50Usd: number
  p75Usd: number
  p90Usd: number
  sampleSize: number
  updatedAt: string
}

export type ZKClaimType = 'SALARY_RANGE' | 'EMPLOYMENT_DURATION'

export interface ZKProofBundle {
  proof: {
    pi_a: [string, string]
    pi_b: [[string, string], [string, string]]
    pi_c: [string, string]
    publicSignals: string[]
  }
  claimType: ZKClaimType
  params: Record<string, number>
}

// ─── Client ──────────────────────────────────────────────────────────────────

export interface OpenRepConfig {
  /** Base URL of an OpenRep-compatible API node. Defaults to ATTESTA public API. */
  apiUrl?: string
  /** Issuer API key (required for issuing credentials) */
  issuerApiKey?: string
  /** Timeout in ms for fetch calls. Default: 10000 */
  timeout?: number
}

export class OpenRep {
  private readonly apiUrl: string
  private readonly issuerApiKey?: string
  private readonly timeout: number

  constructor(config: OpenRepConfig = {}) {
    this.apiUrl = (config.apiUrl ?? 'https://api.attesta.io').replace(/\/$/, '')
    this.issuerApiKey = config.issuerApiKey
    this.timeout = config.timeout ?? 10_000
  }

  // ─── DID ─────────────────────────────────────────────────────────────────

  /** Resolve a DID document (W3C DID Core 1.0) */
  async resolveDID(did: string): Promise<DIDDocument> {
    return this._get(`/protocol/did/${encodeURIComponent(did)}`)
  }

  // ─── Verifiable Credentials ───────────────────────────────────────────────

  /** Fetch VC metadata by ID (no PII returned) */
  async getVC(vcId: string): Promise<VCMetadata> {
    return this._get(`/protocol/vc/${encodeURIComponent(vcId)}`)
  }

  /** Verify a VC by ID or verify a ZK proof bundle */
  async verifyVC(vcIdOrProof: string | ZKProofBundle): Promise<VerifyResult> {
    if (typeof vcIdOrProof === 'string') {
      return this._post('/protocol/verify', { vcId: vcIdOrProof })
    }
    return this._post('/protocol/verify', vcIdOrProof)
  }

  /** Alias for verifyVC with ZK proof */
  async verifyZKProof(bundle: ZKProofBundle): Promise<VerifyResult> {
    return this._post('/protocol/verify', bundle)
  }

  // ─── Profiles ─────────────────────────────────────────────────────────────

  /** Get public profile summary (skills + employment, no PII) */
  async getProfile(did: string): Promise<PublicProfile> {
    return this._get(`/protocol/profile/${encodeURIComponent(did)}`)
  }

  // ─── Issuers ──────────────────────────────────────────────────────────────

  /** List registered OpenRep issuers */
  async listIssuers(filters?: { type?: Issuer['type']; domain?: string }): Promise<Issuer[]> {
    const params = new URLSearchParams()
    if (filters?.type) params.set('type', filters.type)
    if (filters?.domain) params.set('domain', filters.domain)
    const qs = params.toString()
    return this._get(`/protocol/issuers${qs ? `?${qs}` : ''}`)
  }

  // ─── Issuer: issue credential ─────────────────────────────────────────────

  /** Issue a Verifiable Credential (registered issuers only) */
  async issueCredential(input: {
    subjectDid: string
    credentialType: string
    claims: Record<string, unknown>
    issuerApiKey?: string
  }): Promise<VCMetadata> {
    const key = input.issuerApiKey ?? this.issuerApiKey
    if (!key) throw new Error('OpenRep: issuerApiKey required to issue credentials')
    return this._post('/protocol/issue', input, key)
  }

  // ─── LinkedIn lookup (for Chrome extension) ──────────────────────────────

  /** Look up OpenRep profile by LinkedIn username */
  async lookupLinkedIn(username: string): Promise<{ did?: string; kycTier?: string; trustScore?: number; badgeUrl?: string }> {
    return this._get(`/protocol/linkedin/${encodeURIComponent(username)}`)
  }

  /** Resolve multiple DIDs in parallel (max 100 per call). */
  async batchResolve(dids: string[]): Promise<DIDDocument[]> {
    if (dids.length > 100) throw new Error('batchResolve: max 100 DIDs per call')
    return Promise.all(dids.map(did => this.resolveDID(did)))
  }

  /**
   * Find the shortest trust path between two DIDs via the TrustChain protocol.
   * Returns path as ordered array of user IDs (not DIDs) with trust score.
   */
  async getTrustPath(fromDid: string, toDid: string, maxHops = 3): Promise<TrustPath> {
    return this._post('/protocol/trust/path', { fromDid, toDid, maxHops })
  }

  /**
   * Register a webhook to receive credential events for a DID.
   * Requires a valid issuer API key.
   */
  async subscribeWebhook(
    did: string,
    callbackUrl: string,
    events: CredentialEvent[],
    issuerApiKey: string,
  ): Promise<WebhookSubscription> {
    return this._post('/protocol/webhooks', { did, callbackUrl, events }, issuerApiKey)
  }

  /** Query anonymized compensation intelligence for a role/level/geography. */
  async getCompensationIntel(params: {
    role?: string
    level?: 'junior' | 'mid' | 'senior' | 'staff'
    geography?: string
  }): Promise<CompensationIntel> {
    const qs = new URLSearchParams()
    if (params.role) qs.set('role', params.role)
    if (params.level) qs.set('level', params.level)
    if (params.geography) qs.set('geography', params.geography)
    return this._get(`/market/compensation?${qs.toString()}`)
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  private async _get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.apiUrl}${path}`, {
      signal: AbortSignal.timeout(this.timeout),
      headers: { 'User-Agent': '@openrep/sdk/1.0.0', Accept: 'application/json' },
    })
    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText)
      throw new Error(`OpenRep API ${res.status}: ${err}`)
    }
    return res.json() as Promise<T>
  }

  private async _post<T>(path: string, body: unknown, apiKey?: string): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': '@openrep/sdk/1.0.0',
    }
    if (apiKey) headers['X-OpenRep-Issuer-Key'] = apiKey
    const res = await fetch(`${this.apiUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    })
    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText)
      throw new Error(`OpenRep API ${res.status}: ${err}`)
    }
    return res.json() as Promise<T>
  }
}

// ─── Utility helpers ─────────────────────────────────────────────────────────

/** Convert an Ethereum/Polygon wallet address to a did:polygon DID. */
export function walletToDID(address: string): string {
  const normalized = address.toLowerCase().startsWith('0x')
    ? address.toLowerCase()
    : `0x${address.toLowerCase()}`
  return `did:polygon:${normalized}`
}

/** Extract the wallet address from a did:polygon DID, or null for other methods. */
export function didToWallet(did: string): string | null {
  const m = did.match(/^did:polygon:(0x[a-f0-9]{40})$/i)
  return m ? m[1].toLowerCase() : null
}

/** Check whether a string is a valid did:polygon DID. */
export function isPolygonDID(did: string): boolean {
  return /^did:polygon:0x[a-f0-9]{40}$/i.test(did)
}

/** Parse a KYC tier enum value into a human-readable label. */
export function kycTierLabel(tier: string): string {
  const labels: Record<string, string> = {
    T1_GOVT: 'Government Verified',
    T2_EMPLOYER: 'Employer Verified',
    T3_INSTITUTION: 'Institution Verified',
    T4_PEER: 'Peer Verified',
    T5_AI_INFERRED: 'AI Inferred',
    T6_SELF: 'Self Attested',
  }
  return labels[tier] ?? tier
}

/** Compute the numerical trust weight for a KYC tier (matches PRD). */
export function kycTierScore(tier: string): number {
  const scores: Record<string, number> = {
    T1_GOVT: 10,
    T2_EMPLOYER: 9,
    T3_INSTITUTION: 8,
    T4_PEER: 6,
    T5_AI_INFERRED: 5,
    T6_SELF: 1,
  }
  return scores[tier] ?? 0
}

// Re-export types
export type { OpenRepConfig }
export default OpenRep
