# ATTESTA — Project Context for Claude

## What We're Building

**ATTESTA** — "The Trust Infrastructure of Professional Work"

Full-stack professional trust infrastructure. NOT a job board. NOT LinkedIn.
Replaces resumes, ATS, interviews, and siloed reputation at infrastructure level.

- PRD: `ATTESTA_PRD_v1.pdf` (38 pages, June 2026, v1.0 Final)
- Domain: `attesta.io`
- Solo developer build

---

## The Problem

| Problem | Current State | ATTESTA Fix |
|---|---|---|
| Resume fraud | $600B annual cost | Cryptographic attestation |
| Time to hire | 68.5 days average | <14 days target |
| Ghost jobs | 27.4% of listings | 0% — verified posting only |
| ATS eliminates qualified candidates | 88% lost | Skill-match, not keyword match |
| Interview deepfakes | 50% companies affected | Real-work trials + liveness |
| Referral advantage | Network-gated (7% of apps) | Universal via TrustChain |

---

## Five-Module Trust Stack

```
Layer 5 — RoleFit AI          Precision job↔person matching (replace ATS)
Layer 4 — TrustChain Talent   Programmable referral network (smart contracts)
Layer 3 — WorkProof Live      Paid real-work trials 2-8hr (replace interviews)
Layer 2 — ProofWork           Verified credentials (replace resume)
Layer 1 — OpenRep             Open protocol (like HTTP for professional trust)
```

### Module 1: ProofWork (Resume Replacement)
- W3C DID anchored identity (`did:polygon:{walletAddress}`)
- Govt ID via Onfido ZK (proves identity, stores NO PII)
- FaceTec 3D liveness (deepfake/Sybil prevention)
- Employer co-sign flow (Workday/BambooHR → both parties sign → Polygon L2)
- Skills NOT self-claimed: submit artifact → AI evaluates → peer co-attests
- ZK Disclosures: "Prove salary >$150K" without revealing exact figure (SnarkJS client-side)
- Verification Tiers: T1 Govt (10/10) → T2 Employer (9/10) → T3 Institution (8/10) → T4 Peer (6/10) → T5 AI-inferred (5/10) → T6 Self (1/10)
- Chrome extension: ProofWork badge overlay on LinkedIn profiles

### Module 2: WorkProof Live (Interview Replacement)
- Paid 2-8hr real-work trials in browser-sandboxed environments
- VS Code browser (code), Figma Sandbox (design), Jupyter (data)
- AI evaluation per domain: AST analysis, CLIP (design), Llama 3.1 (writing)
- Employer pays $150-$500/trial; candidate gets $50-$200 in 48hrs
- Anti-cheat: WebRTC recording, keystroke entropy, paste detection
- WPTA legal agreement auto-generated (DocuSign), covers 50 US states + EU + India
- Every score → permanent artifact in ProofWork profile

### Module 3: TrustChain Talent (Referral Network)
- AI trust graph from verified ProofWork histories (Neo4j + TigerGraph)
- Path discovery: "2 hops from Company X via [trusted mutual]"
- Smart contract bounties ($1K-$15K) paid in tranches (33%/33%/33%) at hire/90d/180d
- Talent Scout Program: top referrers earn $20K-$80K/year
- Anti-collusion: Isolation Forest + GNN detection

### Module 4: RoleFit AI (ATS Replacement)
- 5 dimensions: Capability 35%, Culture 20%, Growth 20%, Comp 15%, Career 10%
- Extracts REAL requirements from company GitHub repos + Figma (not JD keywords)
- FitScore 0-100 with full explainability (SHAP values)
- Blind Matching Mode: no name/photo/university until mutual interest
- Bias audit: IBM AI Fairness 360, EEOC-format logs
- PPO RL outcome feedback loop (hire outcomes → model retraining)

### Module 5: OpenRep (Protocol Layer)
- MIT-licensed, community-governed via DAO
- W3C DID Core + VC Data Model 1.1 + ZK Disclosure Protocol
- Like HTTP for professional trust — anyone can build on it
- ATTESTA Inc = reference implementation (Red Hat/Linux model)

---

## Tech Stack

### Frontend
- **Framework:** Next.js 14 App Router (TypeScript strict)
- **UI:** shadcn/ui + Tailwind CSS
- **State:** Zustand + TanStack Query (React Query)
- **Animation:** Framer Motion
- **Web3/Wallet:** Privy.io (embedded wallets — users never know blockchain exists)
- **ZK Client:** SnarkJS (browser-side proof generation)
- **Charts:** Recharts + D3.js
- **Forms:** React Hook Form + Zod
- **Testing:** Vitest + Playwright (E2E)
- **Mobile:** React Native (Expo)
- **Extension:** WXT framework (Chrome + Firefox, manifest v3)

### Backend
- **Core API:** Node.js TypeScript + Fastify
- **AI/ML:** Python FastAPI + Celery
- **API Gateway:** GraphQL (Apollo Federation v2) + REST
- **Auth:** Auth.js (Next-Auth) + SIWE + JWT
- **Jobs:** BullMQ (Redis-backed)
- **Real-time:** Socket.io + Redis Pub/Sub
- **Email:** Resend
- **SMS/Push:** Twilio + Firebase Cloud Messaging
- **Search:** Elasticsearch 8.x
- **Rate Limiting:** Upstash Redis

### Blockchain
- **Primary Chain:** Polygon PoS (<$0.01/attestation, 65K TPS)
- **Secondary:** Base L2 (fallback)
- **Smart Contracts:** Solidity 0.8.x + Hardhat
- **Security:** OpenZeppelin + Certik audit
- **DID:** did:polygon (W3C DID Core)
- **Credentials:** W3C VC Data Model 1.1 (JSON-LD)
- **ZK:** Circom 2.0 + Groth16 + PLONK
- **ZK Client Library:** SnarkJS + RapidSNARK
- **Storage:** IPFS via Pinata + Filecoin backup
- **Wallet Abstraction:** Privy.io + EIP-4337 Account Abstraction (gasless)
- **Key Management:** AWS KMS + HSM

### AI/ML
- **Code Eval:** Fine-tuned CodeLlama 70B (AWS Bedrock private inference)
- **Writing Eval:** Fine-tuned Llama 3.1 70B
- **Design Eval:** CLIP + custom vision model
- **Data Eval:** Fine-tuned Mixtral 8x7B
- **Capability Embeddings:** Custom 2048-dim multimodal model
- **Fraud Detection:** Isolation Forest + AutoEncoder
- **Trust Graph:** GraphSAGE (PyTorch Geometric)
- **FitScore Ranker:** LambdaMART + PPO RL (outcome-trained)
- **Liveness:** FaceTec 3D (ISO 30107-3)
- **Requirement Extraction:** GPT-4o fine-tune + Tree-sitter
- **MLOps:** MLflow + Weights & Biases + SageMaker
- **Bias Monitoring:** IBM AI Fairness 360

### Databases
- **Primary Relational:** PostgreSQL 16 (RDS Multi-AZ)
- **Document Store:** MongoDB Atlas (unstructured artifacts)
- **Cache/Session:** Redis 7 (ElastiCache)
- **Vector DB:** Pinecone p2 (10M+ candidate vectors, 2048-dim)
- **Graph DB:** Neo4j AuraDB Enterprise (trust graph)
- **Time Series:** TimescaleDB (reputation score history)
- **Search:** Elasticsearch 8.x
- **Analytics:** ClickHouse (self-hosted OLAP)
- **Data Lake:** S3 + Delta Lake (Spark)
- **ETL:** Apache Airflow + dbt
- **ORM:** Prisma (PostgreSQL)

### Infrastructure
- **Cloud:** AWS (us-east-1 primary, eu-west-1 + ap-south-1 secondary)
- **Containers:** Kubernetes EKS + Helm charts
- **Service Mesh:** Istio (mTLS between services)
- **IaC:** Terraform + Terragrunt
- **CI/CD:** GitHub Actions + ArgoCD (GitOps)
- **CDN:** Cloudflare (edge, DDoS, WAF) + CloudFront (S3 assets)
- **Monitoring:** Datadog (APM, infra, logs) + PagerDuty (alerting)
- **Error Tracking:** Sentry
- **Tracing:** OpenTelemetry + Jaeger
- **Trial Sandbox:** Kata Containers + Firecracker microVMs
- **Code Execution:** Judge0 (open-source, self-hosted)

---

## Core Data Models (Key Tables)

```prisma
// Identity
User         { id, did, email (encrypted), kycTier (T1-T6), polygonAddress }
Profile      { id, userId, reputationVector (JSON), overallTrustScore, visibilitySettings }

// ProofWork
EmploymentRecord    { employerSignature, employeeSignature, chainTxHash, verificationTier }
SkillAttestation    { skillSlug, skillLevel(1-10), evidenceCid, aiEvalScore, chainTxHash }
ProjectRecord       { artifactCid, coParticipantDids, clientSignature, chainTxHash }

// WorkProof Live
Trial               { employerId, candidateId, status, recordingS3Key (encrypted), sandboxContainerId }
TrialScore          { dimension(capability|culture|communication|speed|quality), score(0-100), percentile }
TrialLegal          { wptaDocumentCid, employerSignature, candidateSignature, jurisdiction }

// TrustChain
TrustEdge           { fromUserId, toUserId, strengthScore(0-1), coEmploymentMonths }
ReferralContract    { contractAddress(Polygon), bountyTotal, tranchePercentages, hireTimestamp }

// RoleFit
Role                { capabilityVectorEmbedding(2048-dim), extractedRequirements(JSON), compensationRange }
FitScore            { overallScore, 5 dimension scores, explainability(JSON), blindMode }
HireOutcome         { hired(bool), daysToHire, performanceRating90d, tenureMonths } // feeds RL
```

---

## Key User Flows

### Candidate Onboarding (8 steps)
1. Signup via email/Google/GitHub or SIWE (wallet)
2. Identity: upload govt ID → Onfido ZK → FaceTec liveness
3. Connect GitHub (auto-pull commits, repos), LinkedIn (import starter data)
4. Employment: add employers → co-sign request sent → employer countersigns → on-chain
5. Skills: submit artifact per skill → AI eval (30min SLA) → score issued
6. Privacy: configure public vs ZK-disclosed vs private per field
7. Completeness score shown → prompts for remaining verifications
8. ProofWork Badge generated → shareable link + Chrome extension activated

### Employer Hiring via RoleFit (9 steps)
1. Register: legal entity verification, domain confirmation
2. Define role + compensation range → system requests codebase access (GitHub/Figma)
3. RoleFit AI extracts actual requirements → auto-generates role capability vector
4. Employer reviews extracted requirements → activates Blind Matching Mode
5. RoleFit surfaces top-50 matching candidates ranked by FitScore (anonymized)
6. Employer expresses interest → candidate notified → candidate decides to proceed
7. Identities revealed → WorkProof Live trial scheduled → completed → score returned
8. Offer issued via platform → cryptographically signed → authentic offer letter
9. Hire outcome recorded → feeds RL model → bounty released if TrustChain referral

---

## Business Model (12 Revenue Streams)

| Stream | Model | Pricing |
|---|---|---|
| Employer Verification Access | Per-hire or subscription | $99/hire or $2K/month |
| Enterprise API (ProofWork) | Annual contract | $50K-$500K/year |
| WorkProof Live Trial Fee | Per trial (employer pays) | $150-$500/trial |
| TrustChain Referral Success Fee | 5-10% of bounty | ~$200-$1,500/placement |
| Enterprise Referral Program | Annual SaaS | $25K-$250K/year |
| RoleFit AI Subscription | Monthly SaaS | $5K-$50K/month |
| OpenRep Issuer License | Annual | $5K-$50K/year |
| OpenRep Developer API | Usage-based | $0.01/attestation read |
| Candidate Premium | Monthly subscription | $15/month |
| Compensation Intelligence | Report or API | $2K-$10K/month |
| Hire Guarantee Insurance | % of first year comp | 2-5% premium |
| ZK Disclosure Packages | Per disclosure | $29-$199/package |

### Financial Projections
| Year | Profiles | Enterprise Customers | ARR |
|---|---|---|---|
| 1 | 100K | 50 | $2M |
| 2 | 1M | 250 | $30M |
| 3 | 5M | 750 | $120M |
| 5 | 50M | 5,000 | $500M |
| 8 | 200M | 20,000 | $1.5B |

---

## Build Roadmap (12 Phases, Solo Developer)

### ✅ Currently: Phase 1

```
PHASE 1  │ Scaffold + Auth               │ Week 1-2   │ ← START HERE
PHASE 2  │ ProofWork Profile             │ Week 3-4
PHASE 3  │ KYC + DID on-chain            │ Week 5-7
PHASE 4  │ Employer System + Stripe      │ Week 8-9
PHASE 5  │ Employment Co-Sign            │ Week 10-12
PHASE 6  │ Skills + AI Eval (Code)       │ Week 13-17
PHASE 7  │ ZK Disclosure Engine          │ Week 18-21
PHASE 8  │ Chrome Extension + Dashboard  │ Week 22-26  ← MVP COMPLETE
─────────┼───────────────────────────────┼────────────
PHASE 9  │ WorkProof Live                │ Month 6-9
PHASE 10 │ RoleFit AI                    │ Month 9-12
PHASE 11 │ TrustChain Talent             │ Month 12-15
─────────┼───────────────────────────────┼────────────
PHASE 12 │ OpenRep + Mobile + Scale      │ Month 15-36
```

### Phase Details

**Phase 1 — Scaffold + Auth**
- Turborepo monorepo: `apps/web` (Next.js 14) + `apps/api` (Fastify) + `apps/ai` (FastAPI) + `packages/db` (Prisma) + `packages/ui` + `packages/shared`
- Docker Compose: PostgreSQL 16 + Redis 7
- Auth: email + Google + GitHub OAuth + SIWE
- Privy.io embedded wallet (silent Polygon wallet creation)
- JWT access (15min) + refresh (30 days, Redis)
- GitHub Actions CI
- Done: user signs up → gets wallet → accesses dashboard → CI passes

**Phase 2 — ProofWork Profile**
- `Profile` table, IPFS via Pinata, DID creation
- Profile CRUD, completeness score, ProofWork Badge
- Pages: setup wizard, public profile, edit
- Done: shareable ProofWork profile at `attesta.io/proof/{did}`

**Phase 3 — KYC + DID On-Chain**
- Onfido integration (ZK govt ID verification)
- FaceTec 3D liveness
- DIDRegistry.sol (Polygon) — register/update/resolve DID
- Deploy Polygon Mumbai → mainnet
- Done: T1 verified badge, DID anchored on Polygon

**Phase 4 — Employer System + Stripe**
- `Employer` table, registration + domain verification
- Stripe: per-hire ($99) + subscription ($2K/month)
- Basic employer dashboard shell
- Done: employer registered, paying, dashboard access

**Phase 5 — Employment Co-Sign**
- `EmploymentRecord` table
- Full co-sign flow: request → email → countersign → Polygon anchor
- Workday/BambooHR webhook (optional)
- Done: T2 employment record on-chain

**Phase 6 — Skills + AI Eval**
- GitHub OAuth, repo analysis
- `SkillAttestation` + `SkillEvalJob` tables
- Python FastAPI: CodeLlama 70B via AWS Bedrock
- BullMQ: `skill-eval-queue` + `blockchain-anchor-queue`
- Anti-plagiarism check
- Done: skill submitted → AI scored → on-chain anchored → badge on profile

**Phase 7 — ZK Disclosure**
- Circom circuits: `salaryRange.circom` + `employmentDuration.circom`
- SnarkJS client-side proof generation
- ZK Verifier contracts on Polygon
- Employer request → candidate proof → verified result
- Done: employer sees "Salary >$150K: ✓" without seeing exact figure

**Phase 8 — Chrome Extension + Dashboard = MVP**
- WXT extension: LinkedIn badge overlay
- Full employer dashboard: browse, filter, view, request disclosures
- OpenRep API v1 (all 6 public endpoints)
- Polygon mainnet deployment all contracts
- GDPR, WCAG 2.1 AA, security scanning
- Marketing site live
- Done: MVP shipped

**Phase 9 — WorkProof Live**
- Firecracker microVM sandbox, Judge0, Kubernetes Jobs
- WebRTC recording, anti-cheat, WPTA + DocuSign, Stripe Connect
- AI eval: code + design + writing domains
- Done: full trial lifecycle, candidates paid, employers get signal

**Phase 10 — RoleFit AI**
- Pinecone setup, 2048-dim embeddings
- Requirement extraction (GitHub + Tree-sitter)
- FitScore: 5 dimensions, LambdaMART, SHAP explainability
- Blind mode, bias audit, RL outcome loop
- ATS: Greenhouse, Lever, Ashby
- Done: AI matches candidates to roles, replaces ATS

**Phase 11 — TrustChain**
- Neo4j trust graph, GraphSAGE
- ReferralEscrow.sol + BountyRegistry.sol (Certik audited)
- Path discovery, bounty board, tranche payouts
- Anti-collusion, Talent Scout program
- Done: referral smart contracts live, bounties paying automatically

**Phase 12 — Protocol + Mobile + Scale**
- OpenRep protocol open-sourced (MIT), `@openrep/sdk` on npm
- University issuers (first 10)
- React Native mobile app (iOS + Android)
- OpenRep DAO governance
- Government integrations (India, USPTO, State Bar)
- SOC 2 Type II, multi-region failover, ISO 27001
- International: EU eIDAS 2.0, India DPDP Act
- Done: protocol standard established, 10M profiles target

---

## Smart Contracts (to be built)

```
packages/contracts/src/
├── DIDRegistry.sol           Phase 3 — anchor DID docs on Polygon
├── SalaryRangeVerifier.sol   Phase 7 — ZK salary proof verifier
├── EmploymentVerifier.sol    Phase 7 — ZK employment duration verifier
├── ReferralEscrow.sol        Phase 11 — bounty escrow + tranche release
└── BountyRegistry.sol        Phase 11 — open bounty board management
```

All deployed Polygon PoS mainnet. Certik audit before Phase 11 contracts go live.

---

## Key API Endpoints

### Auth
```
POST /auth/signup          email/OAuth → JWT + refresh
POST /auth/login           access (15min) + refresh (30 days)
POST /auth/refresh         silent refresh
POST /auth/wallet/challenge SIWE challenge
POST /auth/wallet/verify   SIWE sig → JWT
```

### Profile & Attestations (GraphQL)
```
query GetProfile(did)
mutation RequestEmployerAttestation(employerId, role, tenure)
mutation SubmitSkillArtifact(skill, artifactUrl, artifactType)
query GetSkillScore(attestationId)
mutation GenerateZKProof(claim, threshold)
mutation RequestDisclosure(profileDid, claims, purpose)
```

### WorkProof Live (REST)
```
POST /trials                create trial
POST /trials/:id/invite     send invite
POST /trials/:id/sign       candidate signs WPTA
GET  /trials/:id/launch     launch sandbox → secure session URL
POST /trials/:id/submit     submit → trigger AI eval
GET  /trials/:id/score      scorecard
GET  /trials/:id/recording  time-limited signed URL
```

### TrustChain (GraphQL)
```
query TrustPath(targetCompanyId, maxHops=3)
mutation CreateReferral(candidateId, roleId, note)
query BountyBoard(domain, minBounty)
mutation RequestIntroduction(pathId, message)
```

### RoleFit (REST)
```
POST /roles                 create role + trigger extraction
GET  /roles/:id/matches     top-50 FitScore matches (anonymized)
POST /roles/:id/interest    employer expresses interest
GET  /market/compensation   comp intel for role/level/geography
```

### OpenRep Protocol (Public)
```
GET  /protocol/did/:did     resolve DID document
GET  /protocol/vc/:id       retrieve VC metadata (no PII)
POST /protocol/verify       verify VC or ZK proof
GET  /protocol/issuers      list registered issuers
```

---

## Compliance Requirements

| Regulation | Jurisdiction | What to Build |
|---|---|---|
| GDPR | EU/EEA | Data residency eu-west-1, consent management, right to erasure, DPA |
| CCPA/CPRA | California | Opt-out of sale, data portability, deletion |
| EU AI Act (2024) | EU | Bias audit logs, human oversight for hiring AI |
| Illinois HB 3773 | Illinois | AI hiring tool disclosure, bias testing |
| EEOC Guidelines | USA Federal | Adverse impact testing, blind mode option, audit logs |
| SOC 2 Type II | Global | Annual audit (target Year 2) |
| India DPDP Act 2023 | India | Data fiduciary registration, data localization ap-south-1 |

---

## Security Architecture

- Zero-trust: mTLS between all services (Istio service mesh)
- PII: AES-256 at rest, TLS 1.3 in transit, tokenized in app layer
- On-chain: only cryptographic hashes, no PII ever on blockchain
- ZK proofs: generated client-side — server never sees raw data
- Right to erasure: PII scrub from DB + IPFS unpin + DID deactivation
- WAF: Cloudflare blocks OWASP Top 10 at edge
- Secrets: rotated every 30 days (AWS Secrets Manager)
- MFA + YubiKey for all admin operations

---

## Non-Functional Requirements

| Category | Requirement | Target |
|---|---|---|
| Performance | API P95 response | <200ms |
| Performance | FitScore retrieval top-100 | <50ms |
| Performance | ZK proof generation (client) | <3 seconds |
| Performance | Trial sandbox launch | <30 seconds |
| Availability | Platform uptime | 99.9% |
| Scalability | Concurrent trial sessions | 10,000 |
| Scalability | Profile vector DB | 100M+ |
| Security | Critical vulnerability patching | <24 hours |
| Privacy | GDPR deletion SLA | <30 days |
| Reliability | RTO | <1 hour |
| Reliability | RPO | <15 minutes |
| Accessibility | WCAG 2.1 AA | 100% |

---

## User Personas

- **Priya** (27, software engineer, 4yr exp) — sends 60+ apps, gets 2 interviews. ATS kills her despite qualifications. Needs skill-based evaluation.
- **Marcus** (41, product director, employed) — confidential job search. Can't use LinkedIn. Needs private mode + portable reputation.
- **Anika** (34, senior technical recruiter) — 300+ apps per role, can't tell who has real skills. 30% of hires leave in 6 months.
- **Dev** (29, freelance full-stack) — reputation siloed on Upwork. Needs portable verified reputation across all platforms.
- **Elena** (47, VP People, enterprise) — $600K/year background checks. 3 bad hires last year cost $750K each. Needs compliance-ready audit trail.

---

## Strategic Objectives (Year 1-3)

- 10M verified professional profiles within 24 months
- 500 enterprise employer partners within 18 months
- OpenRep protocol adopted by 50+ universities within 36 months
- $120M ARR by end of Year 3
- $500M ARR target by Year 5
- Regulatory alignment: EU AI Act, Illinois HB 3773, EEOC

---

## The Moat

OpenRep as protocol standard = infrastructure moat. Once ATTESTA defines the standard before any government/consortium does, all future hiring flows through ATTESTA-defined protocol. Competes across decades, not quarters. Network effects: every new attestation makes existing attestations more valuable. Every employer signing creates candidate demand. Every candidate creates employer demand. Flywheel has no governor.

---

## Current Status

- [x] Phase 1 — Scaffold + Auth (COMPLETE 2026-07-01)
- [x] Phase 2 — ProofWork Profile (COMPLETE 2026-07-01)
- [x] Phase 3 — KYC + DID On-Chain (COMPLETE 2026-07-02)
- [x] Phase 4 — Employer System + Stripe (COMPLETE 2026-07-02)
- [x] Phase 5 — Employment Co-Sign (COMPLETE 2026-07-03)
- [x] Phase 6 — Skills + AI Eval (COMPLETE 2026-07-03)
- [x] Phase 7 — ZK Disclosure Engine (COMPLETE 2026-07-03)
- [x] Phase 8 — Chrome Extension + Dashboard (COMPLETE 2026-07-03) ← MVP
- [x] Phase 9 — WorkProof Live (COMPLETE 2026-07-03)
- [x] Phase 10 — RoleFit AI (COMPLETE 2026-07-03)
- [x] Phase 11 — TrustChain Talent (COMPLETE 2026-07-03)
- [x] Phase 12 — Protocol + Mobile + Scale (COMPLETE 2026-07-03)
