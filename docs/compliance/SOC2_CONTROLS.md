# ATTESTA — SOC 2 Type II Control Mapping

**Target:** SOC 2 Type II audit by Year 2 (2027)
**Auditor:** To be selected (TBD — Big 4 preferred)
**Scope:** Trust Services Criteria — Security (CC), Availability (A), Confidentiality (C), Privacy (P)

---

## Security (CC) Controls

| Control | Description | Implementation |
|---|---|---|
| CC6.1 | Logical access | JWT (15min) + refresh (30d), MFA for admin, YubiKey required |
| CC6.2 | Authentication | Auth.js + SIWE + bcrypt (rounds=12) for stored hashes |
| CC6.3 | Authorization | Fastify `authenticate` middleware, row-level ownership checks |
| CC6.6 | Network security | Cloudflare WAF (OWASP Top 10), Istio mTLS, private EKS |
| CC6.7 | Encryption | AES-256 at rest (RDS + S3), TLS 1.3 in transit, AWS KMS |
| CC7.1 | Monitoring | Datadog APM + PagerDuty alerting, OpenTelemetry tracing |
| CC7.2 | Vulnerability scanning | GitHub Dependabot + Snyk, 24h SLA for critical CVEs |
| CC8.1 | Change management | GitHub Actions CI, ArgoCD GitOps, PR reviews required |
| CC9.1 | Risk assessment | Quarterly review, Terraform drift detection |

## Availability (A) Controls

| Control | Description | Implementation |
|---|---|---|
| A1.1 | Capacity management | EKS HPA + KEDA autoscaling, Pinecone p2 tier |
| A1.2 | Recovery | RTO <1hr, RPO <15min, Multi-AZ RDS, Redis ElastiCache HA |
| A1.3 | Monitoring | Datadog uptime checks, 99.9% SLA target |

## Confidentiality (C) Controls

| Control | Description | Implementation |
|---|---|---|
| C1.1 | Data classification | PII encrypted at app layer (tokenized), only hashes on-chain |
| C1.2 | Disposal | GDPR erasure: DB scrub + IPFS unpin + DID deactivation |

## Privacy (P) Controls

| Control | Description | Implementation |
|---|---|---|
| P1.1 | Privacy notice | Terms + Privacy Policy (attesta.io/privacy) |
| P3.1 | Consent | Explicit consent at signup, granular settings per field |
| P4.1 | Data retention | Configurable per user, 30-day deletion SLA |
| P6.1 | Third parties | Onfido (ZK — no PII stored), FaceTec (ISO 30107-3), Stripe (PCI DSS) |
| P8.1 | Accountability | DPA with all sub-processors, Compliance Officer designated |

---

## GDPR Article Mapping

| Article | Requirement | Implementation |
|---|---|---|
| Art. 5 | Data minimization | ZK proofs — prove claims without revealing raw data |
| Art. 13/14 | Transparency | Privacy dashboard, field-level disclosure controls |
| Art. 17 | Right to erasure | `/settings/delete` → 30-day SLA, IPFS unpin, DID deactivation |
| Art. 20 | Data portability | `/settings/export` → JSON export of all profile data |
| Art. 22 | Automated decisions | SHAP explainability on FitScore, human override available |
| Art. 25 | Privacy by design | ZK client-side, no PII on-chain, encrypted at rest |
| Art. 30 | Records of processing | Automated via compliance middleware audit log |
| Art. 35 | DPIA | Required for FitScore AI and liveness detection — to be completed |

---

## EU AI Act Article Mapping (2024)

| Article | Requirement | Implementation |
|---|---|---|
| Art. 9 | Risk management | Quarterly bias audits, IBM AI Fairness 360 |
| Art. 10 | Data governance | Training data documented, bias testing per model |
| Art. 13 | Transparency | SHAP explainability on all FitScore outputs |
| Art. 14 | Human oversight | Override flag in employer dashboard |
| Art. 17 | Quality management | MLflow + W&B experiment tracking, model cards |
| Art. 62 | Incident reporting | Sentry + PagerDuty → 72h GDPR breach notification |

---

## EEOC Compliance

- Blind Matching Mode: name, photo, university hidden until mutual interest
- Adverse impact testing: 4/5ths rule checked per demographic dimension in FitScore
- Audit log: all hiring AI decisions logged with SHAP values for inspection
- Illinois HB 3773: AI hiring tool disclosure in employer onboarding flow

---

## Audit Readiness Checklist

- [ ] Select SOC 2 auditor (Year 2)
- [ ] Complete DPIA for FitScore + liveness systems
- [ ] Register as Data Fiduciary under India DPDP Act
- [ ] Implement consent management platform (CMP) for EU users
- [ ] Run first IBM AI Fairness 360 bias report
- [ ] DPA agreements with all sub-processors
- [ ] Penetration test (annual) — schedule with Trail of Bits or NCC Group
- [ ] ISO 27001 certification (Year 3 target)
