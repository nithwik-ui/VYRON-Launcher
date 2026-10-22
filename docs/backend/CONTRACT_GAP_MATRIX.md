# VYRON Contract Gap Matrix

**Document ID:** `docs/backend/CONTRACT_GAP_MATRIX.md`  
**Phase:** Phase 3A.1  
**Scope:** Systematic alignment between Phase 3A contracts and Phase 3B/3C implementation prerequisites.

---

## 1. Matrix Overview

This matrix identifies every contract interface, verifies the corresponding Android or Backend requirement, tracks the source of authority, and mandates explicit compliance criteria.

| Subsystem / Interface | Specified Contract | Codebase / Local Reality | Gap / Risk | Resolution & Invariant |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication** | Dual identity: VYRON Auth vs MSA Auth | Legacy stored MSA tokens in plaintext `accounts/<name>.json` | Potential token leak to cloud or local malware | Migrated to AES-256-GCM `AndroidKeyStore` (`VyronSecureCredentialStore`). VYRON API never receives MSA tokens. |
| **Persistence** | `launcher_profiles.json` local sovereignty | Android Pojav legacy relies directly on `launcher_profiles.json` | Cloud profile sync attempting to overwrite local disk | Local disk is strictly authoritative. Backend only provides additive metadata (e.g. loader icons). |
| **Game Launch** | Zero backend dependency | `MinecraftDownloader` checks local json first | Backend down must not crash launcher | Complete network bypass implemented when `!isOnline || isLocalProfile`. |
| **API Error Handling** | Standardized JSON envelope | Diverse legacy HTTP error codes | Inconsistent client parsing | Standardized schema enforced in Fastify global error handler. |
| **Compatibility Data** | 7-axis compatibility matrix | Unsupported hardware claimed as working | User crashes on unsupported devices | Status defaults to `UNKNOWN` until verified by device test logs. |
| **Server Directory** | Promoted campaigns | Commercial server ads without disclosures | FTC / Play Store non-compliance | Enforce mandatory `SPONSORED` badge and campaign killswitch. |
| **Telemetry** | Opt-in anonymous metrics | Crash reporting logging environment strings | PII or username leakage | Automatic token/key redaction in all logging and telemetry layers. |
| **Database TLS** | Strict TLS certificate verification | Development default `sslaccept=accept_invalid_certs` | Man-in-the-Middle risk in production | Environment-gated TLS: production enforces valid certificates; development allows fallback. |
| **Schema Evolution** | Versioned Prisma migrations | `prisma db push` used in initial scaffolding | Drift in production schema | Production deployments strictly mandate `prisma migrate deploy`. |

---

## 2. Invariant Checklist for Implementation
- [x] Microsoft OAuth credentials strictly isolated to on-device keystore.
- [x] Local `.minecraft` directory remains authoritative.
- [x] Offline launch path validated with zero network queries.
- [x] Standardized error envelope enforced.
- [x] Sponsored servers explicitly labeled.
- [x] Telemetry sanitized and opt-in.
