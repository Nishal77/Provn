# @openrep/sdk

**OpenRep** — the open protocol for professional trust.

Like HTTP for professional credentials. MIT-licensed, community-governed via DAO.

```bash
npm install @openrep/sdk
```

## Overview

OpenRep is a W3C DID + Verifiable Credential protocol that any platform can build on.
ATTESTA is the reference implementation (Red Hat/Linux model).

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Application                         │
├─────────────────────────────────────────────────────────────┤
│                    @openrep/sdk                             │
├─────────────────────────────────────────────────────────────┤
│  W3C DID Core  │  VC Data Model 1.1  │  ZK Disclosure      │
├─────────────────────────────────────────────────────────────┤
│                  Polygon PoS                                │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

```typescript
import { OpenRep } from '@openrep/sdk'

const client = new OpenRep({
  apiUrl: 'https://api.attesta.io',
  // or self-hosted: apiUrl: 'https://your-openrep-node.example.com'
})

// Resolve a DID document
const didDoc = await client.resolveDID('did:polygon:0xabc...')

// Verify a Verifiable Credential
const result = await client.verifyVC('vc_abc123')

// Verify a ZK proof (salary range, employment duration)
const zkResult = await client.verifyZKProof({
  proof: { pi_a, pi_b, pi_c, publicSignals },
  claimType: 'SALARY_RANGE',
  params: { minSalary: 150_000, maxSalary: 250_000 }
})

// Get public profile by DID
const profile = await client.getProfile('did:polygon:0xabc...')

// List registered issuers (universities, employers)
const issuers = await client.listIssuers({ type: 'university' })
```

## Protocol Specification

- **DID Method:** `did:polygon` (W3C DID Core 1.0)
- **Credential Format:** W3C VC Data Model 1.1 (JSON-LD)
- **ZK Proofs:** Groth16 via Circom 2.0 + SnarkJS
- **Blockchain:** Polygon PoS (<$0.01/attestation)
- **Privacy:** ZK disclosures generated client-side — server never sees raw data

## Verification Tiers

| Tier | Source | Trust Score |
|------|--------|-------------|
| T1 | Government ID (Onfido ZK) | 10/10 |
| T2 | Employer co-sign (on-chain) | 9/10 |
| T3 | Institution (university) | 8/10 |
| T4 | Peer attestation | 6/10 |
| T5 | AI-inferred | 5/10 |
| T6 | Self-declared | 1/10 |

## Issuer Registration

Universities, employers, and government agencies can register as OpenRep issuers:

```typescript
// Issue a credential (registered issuers only)
const vc = await client.issueCredential({
  subjectDid: 'did:polygon:0x...',
  credentialType: 'UniversityDegree',
  claims: { degree: 'BSc Computer Science', graduationYear: 2022 },
  issuerApiKey: process.env.OPENREP_ISSUER_KEY
})
```

## DAO Governance

OpenRep is governed by the OpenRep DAO. Token holders vote on:
- Protocol upgrades
- New issuer tiers
- ZK circuit updates
- Fee parameters

Join: [dao.openrep.io](https://dao.openrep.io)

## License

MIT © ATTESTA Inc. — See [LICENSE](./LICENSE)
