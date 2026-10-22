# VYRON Phase 3A: Backend Architecture & Service Contract Audit Report
**Document ID:** `docs/backend/PHASE_3A_REPORT.md`  
**Phase:** Phase 3A (Backend Architecture & Service Contract Audit)  
**Product:** VYRON — *Your Minecraft. Your World.*  
**Lead Architect & Systems Engineer:** Antigravity Engineering Team  
**Date:** October 2026  
**Status:** COMPLETE — READY FOR EXECUTIVE REVIEW  

---

## 1. Executive Summary

Phase 3A was executed in strict adherence to the **Absolute Rules**: **NO backend services, databases, migrations, mock endpoints, or server code were deployed**. The existing Android launcher engine remains protected and 100% operational.

This phase produced a comprehensive, code-verified audit of the entire repository (`nithwik-ui/VYRON-Launcher`, branch `v3_openjdk`) and delivered the complete architectural specifications, database schemas, REST API contracts, and security models required before backend engineering begins.

### Complete Deliverable Index:
1. [`docs/backend/AUTH_AUDIT.md`](file:///k:/VYRON%20LAUNCHER/docs/backend/AUTH_AUDIT.md): Account storage, Microsoft OAuth pipeline, token lifecycle, and security gaps.
2. [`docs/backend/PERSISTENCE_AUDIT.md`](file:///k:/VYRON%20LAUNCHER/docs/backend/PERSISTENCE_AUDIT.md): Inventory of SharedPreferences, JSON stores, and engine game data.
3. [`docs/backend/SERVICE_BOUNDARY.md`](file:///k:/VYRON%20LAUNCHER/docs/backend/SERVICE_BOUNDARY.md): Demarcation between local launcher autonomy vs. backend cloud services.
4. [`docs/backend/BACKEND_ARCHITECTURE.md`](file:///k:/VYRON%20LAUNCHER/docs/backend/BACKEND_ARCHITECTURE.md): Fastify / Node.js / PostgreSQL / Redis modular monolith architecture.
5. [`docs/backend/DATABASE_SCHEMA.md`](file:///k:/VYRON%20LAUNCHER/docs/backend/DATABASE_SCHEMA.md): PostgreSQL DDL schema with Phase 1, Phase 2, and Future horizon entities.
6. [`docs/backend/API_SPEC.md`](file:///k:/VYRON%20LAUNCHER/docs/backend/API_SPEC.md): Complete `/api/v1/` REST API contracts, envelopes, and error schemas.
7. [`docs/backend/SERVER_PROMOTION.md`](file:///k:/VYRON%20LAUNCHER/docs/backend/SERVER_PROMOTION.md): Featured server campaign lifecycle and transparent sponsored disclosure.
8. [`docs/backend/NEWS_CMS.md`](file:///k:/VYRON%20LAUNCHER/docs/backend/NEWS_CMS.md): Markdown news CMS, publication workflows, and Android delivery feeds.
9. [`docs/backend/MINECRAFT_VERSION_SERVICE.md`](file:///k:/VYRON%20LAUNCHER/docs/backend/MINECRAFT_VERSION_SERVICE.md): Piston manifest discovery and normalization pipeline.
10. [`docs/backend/COMPATIBILITY.md`](file:///k:/VYRON%20LAUNCHER/docs/backend/COMPATIBILITY.md): Multi-dimensional device, GPU, Java, and loader compatibility matrix.
11. [`docs/backend/ADMIN_RBAC.md`](file:///k:/VYRON%20LAUNCHER/docs/backend/ADMIN_RBAC.md): Single Control Center application with fine-grained RBAC permissions.
12. [`docs/backend/SECURITY_MODEL.md`](file:///k:/VYRON%20LAUNCHER/docs/backend/SECURITY_MODEL.md): Argon2id hashing, token rotation, session invalidation, and privacy safeguards.
13. [`docs/backend/TELEMETRY.md`](file:///k:/VYRON%20LAUNCHER/docs/backend/TELEMETRY.md): Privacy-preserving operational and performance telemetry specifications.

---

## 2. Existing Architecture Findings

The launcher's technical foundation is comprised of:
- **Application ID:** `com.vyron.launcher` (Namespace: `net.kdt.pojavlaunch`).
- **Engine Process Isolation:** Gameplay executes in an isolated Linux process (`process=":game"`) managed by `LauncherActivity.java` and `MainActivity.java`.
- **Runtime Execution:** Employs `dlopen` and custom JNI bridges (`jre_launcher.c`) to bootstrap desktop OpenJDK instances (JRE 8, 17, 21, 25) on Android.
- **Rendering Stack:** ANGLE (OpenGL ES to Vulkan/GLES), Mesa Gallium Zink (OpenGL over Vulkan), MobileGlues, and SimpleFPEWrapper.
- **Storage Access Framework:** `FolderProvider.java` exposes `.minecraft` to third-party file managers under `com.vyron.launcher.scoped.gamefolder`.

---

## 3. Authentication Findings & Security Deficiencies

Auditing `MinecraftAccount.java`, `MicrosoftBackgroundLogin.java`, and `mcAccountSpinner.java` revealed the following critical findings:
1. **Plaintext Credential Storage (High Severity):**
   - Microsoft OAuth refresh tokens (`msaRefreshToken`), Minecraft Bearer access tokens (`accessToken`), Xbox User IDs (`xuid`), and Player UUIDs (`profileId`) are stored in unencrypted JSON files at `/data/user/0/com.vyron.launcher/accounts/<username>.json`.
   - **Remediation Plan for Phase 3B:** Introduce Android Keystore / EncryptedSharedPreferences to encrypt all local tokens at rest.
2. **Direct Network Execution in UI Classes:**
   - `mcAccountSpinner.java` (a UI View widget) directly executes background network authentication tasks.
   - `MinecraftAccount.java` performs synchronous network downloads inside `updateSkinFace()`.
   - **Remediation Plan for Phase 3B:** Abstract all authentication and profile operations into a clean Android MVVM Repository (`VyronAccountRepository.java`).
3. **Local-Only Account Deletion:**
   - Account removal simply deletes the local JSON file. No server-side token revocation request is dispatched to Microsoft identity endpoints.
4. **Active Account Persistence:**
   - Currently tracked in `SharedPreferences` (`pojav_profile.xml`, key `"file"`).

---

## 4. Persistence Findings

- **No Second Database:** Confirmed that `LauncherProfiles.java` is the single source of truth for Minecraft instances (`.minecraft/launcher_profiles.json`).
- **Device Hardware Separation:** Hardware-specific settings (RAM allocation, resolution ratio, notch sizes, renderer) reside in `LauncherPreferences.DEFAULT_PREF`.
- **Storage Breakdown:**
  - App-Internal Storage (`/data/user/0/com.vyron.launcher`): Runtimes, account JSONs, private preferences.
  - App-External Storage (`/sdcard/Android/data/com.vyron.launcher/files/.minecraft`): Versions, libraries, assets, saves, mods, controls.

---

## 5. Backend Boundary & Sovereignty

The boundary was strictly codified in [`docs/backend/SERVICE_BOUNDARY.md`](file:///k:/VYRON%20LAUNCHER/docs/backend/SERVICE_BOUNDARY.md):
- **Local Sovereignty:** Local instance configuration, Java runtime management, asset downloading from Mojang, touch controls, worlds, mods, and game launching remain 100% autonomous on the device.
- **Backend Scope:** VYRON account identity, community servers, featured campaigns, curated news feed, version discovery metadata, hardware compatibility profiles, release distribution, and anonymized performance telemetry.
- **Invariant:** The backend NEVER acts as a relay or proxy for official Minecraft game files, assets, or libraries.

---

## 6. Recommended Backend Architecture

- **Stack:** TypeScript, Node.js, Fastify, PostgreSQL (16+), Redis (7+), Cloudflare Edge CDN, and S3-compatible storage (Cloudflare R2).
- **Topology:** Modular Monolith with domain-partitioned modules (`auth`, `user`, `news`, `servers`, `promotions`, `minecraft`, `compatibility`, `releases`, `telemetry`, `admin`).
- **Comparative Analysis:** Evaluated against Go, Python/FastAPI, Java/Spring Boot, and Rust. TypeScript + Fastify was selected for its exceptional I/O throughput, schema compilation velocity, and seamless end-to-end type sharing with the Next.js Admin application.

---

## 7. Database Design & Entity Schema

Designed 24 PostgreSQL tables across 7 distinct domains in [`docs/backend/DATABASE_SCHEMA.md`](file:///k:/VYRON%20LAUNCHER/docs/backend/DATABASE_SCHEMA.md):
- **Identity:** `users`, `user_sessions`, `oauth_accounts`, `devices`.
- **Minecraft:** `minecraft_accounts`, `minecraft_versions`, `minecraft_version_metadata`, `java_runtimes`, `compatibility_profiles`.
- **Servers:** `servers`, `server_status`, `server_favorites`, `server_campaigns`, `server_promotions`.
- **Content:** `news_categories`, `news_articles`, `announcements`.
- **Releases:** `launcher_releases`, `rollout_rules`.
- **Administration:** `roles`, `permissions`, `role_permissions`, `admin_users`, `admin_audit_logs`.
- **Future:** `cloud_backups`, `subscriptions`, `payments`, `support_tickets`, `analytics_events`.

---

## 8. REST API Contract (`/api/v1/`)

Codified standard request headers, response envelopes (`{ success, data, meta }`), standard error format, pagination, and endpoints across Auth, Profile, News, Minecraft, Servers, Featured Servers, Releases, and Telemetry in [`docs/backend/API_SPEC.md`](file:///k:/VYRON%20LAUNCHER/docs/backend/API_SPEC.md).

---

## 9. Minecraft Version Ingestion Service

Pipeline specified in [`docs/backend/MINECRAFT_VERSION_SERVICE.md`](file:///k:/VYRON%20LAUNCHER/docs/backend/MINECRAFT_VERSION_SERVICE.md):
- Ingestion worker queries Mojang's official Piston Manifest v2 (`https://piston-meta.mojang.com/mc/game/version_manifest_v2.json`) using ETag caching.
- Validates SHA-1 digests, parses Java version requirements, normalizes dependencies, and updates the compatibility catalog without storing multi-gigabyte game files.

---

## 10. News CMS & Announcement Engine

Specified in [`docs/backend/NEWS_CMS.md`](file:///k:/VYRON%20LAUNCHER/docs/backend/NEWS_CMS.md):
- Markdown article authoring with lifecycle states: `DRAFT`, `REVIEW`, `SCHEDULED`, `PUBLISHED`, `ARCHIVED`.
- Android client caches articles in local cache for offline reading.
- Urgent broadcast announcements (`INFO`, `WARNING`, `CRITICAL`, `MAINTENANCE`) delivered as top-level home screen banners.

---

## 11. Featured Server Monetization & Ethical Transparency

Specified in [`docs/backend/SERVER_PROMOTION.md`](file:///k:/VYRON%20LAUNCHER/docs/backend/SERVER_PROMOTION.md):
- Commercial campaign scheduling with start/end windows and impression tracking.
- **Strict Transparency Mandate:** Paid listings must display conspicuous `SPONSORED` badges. Organic rankings (`POPULAR`, `COMMUNITY`, `FEATURED`) are strictly protected from commercial corruption.

---

## 12. Administration & Control Center (RBAC)

Specified in [`docs/backend/ADMIN_RBAC.md`](file:///k:/VYRON%20LAUNCHER/docs/backend/ADMIN_RBAC.md):
- Single unified web application (**VYRON Control Center** in Next.js).
- 7 distinct roles: `SUPER_ADMIN`, `CONTENT_ADMIN`, `SERVER_ADMIN`, `RELEASE_ADMIN`, `MODERATOR`, `SUPPORT_ADMIN`, `ANALYTICS`.
- Multi-Factor Authentication (TOTP) and append-only immutable audit logging in `admin_audit_logs`.

---

## 13. Security Model & Cryptography

Specified in [`docs/backend/SECURITY_MODEL.md`](file:///k:/VYRON%20LAUNCHER/docs/backend/SECURITY_MODEL.md):
- Password hashing with **Argon2id** (64MB memory, 3 passes).
- Short-lived JWT access tokens (15 mins) + rotated cryptographic refresh tokens (30 days).
- Automatic replay detection revokes entire session trees if compromised refresh tokens are reused.
- Multi-tier Redis sliding-window rate limiting.

---

## 14. Telemetry & Observability (Design Only)

Specified in [`docs/backend/TELEMETRY.md`](file:///k:/VYRON%20LAUNCHER/docs/backend/TELEMETRY.md):
- Strict Non-PII design tracking launcher lifecycle, launch success/failure stages, download throughput, FPS averages, and sanitized engine crash stack traces.
- Client batches events in memory, preferring unmetered Wi-Fi.

---

## 15. Offline-First Client Behavior

The Android client handles backend unavailability gracefully:
1. **Instant Offline Detection:** Network errors or HTTP 5xx responses trigger the offline state.
2. **Local Fallback:** Home screen displays cached news and local instance hero card.
3. **Unimpeded Gameplay:** The user can configure instances, modify controls, and launch installed Minecraft versions without seeing blocking dialogs or error popups.
4. **Friendly Non-Intrusive Notice:** A subtle banner displays: *"You're offline. Some online features aren't available."*

---

## 16. Technical Risks & Mitigation Strategies

| Risk Identified | Severity | Mitigation Strategy |
|---|:---:|---|
| **Plaintext Token Storage on Device** | High | Migrate `MinecraftAccount` persistence to Android Keystore / EncryptedSharedPreferences in Phase 3B. |
| **Mojang API Outages / Rate Limiting** | Medium | Client caches version manifests; backend mirrors metadata with 1-hour Redis TTL. |
| **Server Promotion Fraud / Malicious Servers** | High | Mandatory staff review (`PENDING_APPROVAL`), Mojang EULA verification, and instant admin kill-switch. |
| **High Telemetry Bandwidth Cost** | Medium | Client-side event aggregation, batched transmission, gzip compression, and opt-out support. |

---

## 17. Open Questions for Product Review

1. **VYRON Account Mandatory vs. Optional:**  
   *Recommendation:* Allow players to use VYRON completely offline with local accounts, while offering VYRON cloud accounts for cross-device favorites, custom skin showcase, and future cloud backups.
2. **Featured Server Pricing Model:**  
   *Recommendation:* Begin with flat weekly/monthly placement fees managed by Server Admins before introducing automated CPM/CPC bidding.
3. **Telemetry Opt-In Default:**  
   *Recommendation:* Default to enabled with a prominent toggle in Launcher Settings and an initial launch consent prompt to ensure Play Store and GDPR compliance.

---

## 18. Recommended Implementation Roadmap

1. **Phase 3B: Android Architecture Clean-Up & Client Security Hardening**
   - Refactor `MinecraftAccount` storage into Android Keystore / `EncryptedSharedPreferences`.
   - Decouple network calls from `mcAccountSpinner` into a clean MVVM Repository.
2. **Phase 3C: Backend Scaffolding & Core Identity**
   - Initialize Fastify project, PostgreSQL migrations (Phase 1 Baseline tables), and Redis.
   - Implement `/api/v1/auth/` and `/api/v1/profile/`.
3. **Phase 3D: Content Services (News, Announcements, Servers)**
   - Implement News CMS, Server Directory, and Piston Version Ingestion.
   - Deploy Cloudflare R2 media storage.
4. **Phase 3E: Control Center & Admin RBAC**
   - Build unified Next.js admin dashboard.
5. **Phase 3F: Client-Backend Integration**
   - Wire Android client to live endpoints with offline-first fallbacks.

---

## 19. Compilation & Verification Gate

The Android project continues to compile cleanly with zero errors. All changes in this phase were strictly architectural audits, system specifications, and documentation additions.

```text
STATUS: PHASE 3A COMPLETE
ACTION: STOPPED. AWAITING REVIEW BEFORE PROCEEDING TO PHASE 3B.
```
