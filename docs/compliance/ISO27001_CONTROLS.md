# ATTESTA — ISO 27001:2022 Control Mapping

**Target certification:** Year 3 (2028)
**Scope:** ATTESTA platform, infrastructure, and OpenRep protocol

---

## Annex A Controls (ISO 27001:2022)

### A.5 — Organizational Controls

| Control | Status | Notes |
|---|---|---|
| A.5.1 Policies | Draft | Security Policy, Acceptable Use, Data Classification |
| A.5.2 Roles | In Progress | CISO (founder dual-hatting), DPO designated |
| A.5.8 Info sec in SDLC | Active | GitHub Actions security scanning, Dependabot |
| A.5.23 Cloud security | Active | AWS shared responsibility model, CIS Benchmarks |

### A.6 — People Controls

| Control | Status | Notes |
|---|---|---|
| A.6.1 Screening | Planned | Background checks for contractors |
| A.6.3 Awareness | Planned | Annual security training |
| A.6.7 Remote work | Active | VPN + YubiKey required for production access |

### A.7 — Physical Controls

| Control | Status | Notes |
|---|---|---|
| A.7.1 Physical perimeters | Active | AWS data centers (ISO 27001 certified) |
| A.7.8 Equipment | Active | Encrypted laptops, remote wipe enabled |

### A.8 — Technological Controls

| Control | Status | Notes |
|---|---|---|
| A.8.2 Privileged access | Active | IAM least-privilege, YubiKey for AWS console |
| A.8.3 Information access | Active | RBAC in API, row-level ownership |
| A.8.5 Authentication | Active | JWT + MFA, SIWE wallet auth |
| A.8.7 Malware protection | Active | GuardDuty, Cloudflare WAF |
| A.8.8 Vulnerabilities | Active | Dependabot + Snyk, 24h critical patch SLA |
| A.8.12 Data leakage | Active | No PII on-chain, ZK proofs client-side |
| A.8.15 Logging | Active | Datadog APM, compliance middleware audit log |
| A.8.16 Monitoring | Active | PagerDuty alerts, Sentry error tracking |
| A.8.23 Web filtering | Active | Cloudflare proxy, OWASP Top 10 WAF rules |
| A.8.24 Cryptography | Active | AES-256 at rest, TLS 1.3, Groth16 ZK proofs |
| A.8.25 Secure dev lifecycle | Active | SAST (CodeQL), DAST (OWASP ZAP), PR reviews |
| A.8.28 Secure coding | Active | TypeScript strict mode, Zod validation, Solidity audits |

---

## Statement of Applicability (SoA) Summary

All 93 controls assessed. Applicable: 78. Not applicable: 15 (physical media controls — cloud-native).

---

## Certification Timeline

| Milestone | Target Date |
|---|---|
| Gap assessment | Month 18 (Jan 2028) |
| Implement gaps | Month 20 (Mar 2028) |
| Stage 1 audit (documentation) | Month 22 (May 2028) |
| Stage 2 audit (controls testing) | Month 24 (Jul 2028) |
| Certification issued | Month 25 (Aug 2028) |
