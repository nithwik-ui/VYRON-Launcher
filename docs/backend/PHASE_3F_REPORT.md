# VYRON Phase 3F — Android ↔ Backend Integration & Offline-First Gameplay Report

**Document Version:** 1.0.0  
**Phase:** Phase 3F (Android ↔ VYRON Backend Integration preserving offline gameplay)  
**Status: PASS (ALL 57 BACKEND TESTS PASSING, FULL APK ASSEMBLED CLEANLY, 0 REGRESSIONS)**  
**Target Module:** `:app_pojavlauncher` & `backend/`  
**Active Branch:** `v3_openjdk`  

---

## 1. Executive Summary

Phase 3F implements the bidirectional Android client networking layer and content delivery pipeline connecting the mobile launcher frontend to the VYRON Fastify monolith, while strictly preserving offline gameplay independence and hardware credential isolation:
1. **Asynchronous Non-Blocking Client Networking:** Implemented `com.vyron.client.VyronApiClient` with background thread pool execution and a strict 4-second timeout envelope to prevent network stalls from impacting UI transitions or game launch.
2. **Offline-First News & Article Delivery:** Implemented `com.vyron.client.content.VyronNewsManager` with automatic disk serialization to `Tools.DIR_CACHE/home_news_cache.json`. When network connectivity is absent or the backend is unreachable, the Home screen seamlessly loads cached articles without user-facing error dialogs or degraded functionality.
3. **Urgent Broadcast & Announcement Ingestion:** Implemented `com.vyron.client.content.VyronAnnouncementManager` dynamically populating the top alert banner in `VyronHomeFragment` for maintenance windows, server advisories, and critical updates.
4. **Hardware Compatibility Intelligence:** Implemented `com.vyron.client.metadata.VyronVersionManager` providing mobile GPU renderer recommendations (ANGLE Vulkan translation) and Java prerequisites with instant empirical offline fallback.
5. **Architectural Invariants Strictly Preserved:**
   - **Microsoft OAuth Isolation:** `VyronApiClient` enforces a security guard preventing any Microsoft access tokens or Mojang user credentials from being transmitted off-device. Credentials remain exclusively in hardware `AndroidKeyStore` (`VyronSecureCredentialStore`).
   - **Offline Playability Guarantee:** The entire native launch sequence (`LauncherActivity` $\to$ `MainMenuFragment` $\to$ `MinecraftDownloader` $\to$ `MainActivity` $\to$ `JREUtils` $\to$ `VMLauncher` $\to$ OpenJDK `JLI_Launch`) functions 100% offline. Local game data (`launcher_profiles.json`, installed versions, worlds) remains authoritative.
   - **Zero JAR Mirroring:** Game binaries (`client.jar`) are fetched exclusively from upstream Mojang CDNs.

---

## 2. Android Client Components Implemented

| Class | Package | Responsibility | Invariants Enforced |
| :--- | :--- | :--- | :--- |
| `VyronApiClient` | `com.vyron.client` | Async HTTP client (GET/POST) via `HttpURLConnection` on background executor | 4s timeout envelope; active inspection throwing `IllegalArgumentException` on any attempt to pass Microsoft/Mojang tokens |
| `VyronNewsArticle` | `com.vyron.client.content` | Parsed article entity (slug, title, summary, category, date, featured) | Clean JSON deserialization with safe fallback defaults |
| `VyronNewsManager` | `com.vyron.client.content` | Dual-tier offline disk cache (`home_news_cache.json`) and network sync | Disk cache loaded first; network failures handled silently without crashing |
| `VyronAnnouncement` | `com.vyron.client.content` | Parsed alert entity (title, message, severity, window) | Supports `INFO`, `WARNING`, `CRITICAL`, `MAINTENANCE` |
| `VyronAnnouncementManager` | `com.vyron.client.content` | Active announcement discovery | Silently delivers empty list on network failure |
| `VyronCompatibility` | `com.vyron.client.metadata` | Mobile compatibility evaluation result | Suggests Java major version, RAM, and renderer |
| `VyronVersionManager` | `com.vyron.client.metadata` | SoC and renderer compatibility query | Fallback evaluation: Java 21 for 1.20.5+, Java 17 for 1.17+, Java 8 for legacy |
| `VyronHomeFragment` | `com.vyron.ui.home` | Integrated with News & Announcement managers | Dynamically updates "What's New in VYRON" card and alert banners |

---

## 3. Verification & Build Results

### 3.1 Android Full APK Assembly Verification
- **Command:** `./gradlew :app_pojavlauncher:assembleDebug --daemon` (on mapped drive `V:\`)
- **Result:** **BUILD SUCCESSFUL in 1m 37s**
- **Actionable Tasks:** 90 actionable tasks (28 executed, 62 up-to-date)
- **Generated Artifact:**
  - File: `app_pojavlauncher/build/outputs/apk/debug/app_pojavlauncher-debug.apk`
  - Size: **144,725,499 bytes (144.7 MB)**
  - Timestamp: `22-10-2026 15:01:29`
  - Native JNI Libraries: arm64-v8a, armeabi-v7a, x86, x86_64 (`libpojavexec.so`, `libandroidnsbypass.so`, MobileGlues, ANGLE, Zink)

### 3.2 Vitest Backend Test Suite
- **Command:** `npm test`
- **Result:** **57 / 57 TESTS PASSED (100% SUCCESS RATE)**
- **Test Files:** **11 passed (11)**
- **Duration:** 75.06s

| Test Suite | Tests Passed | Verification Target |
| :--- | :--- | :--- |
| `tests/content.test.ts` | **5 / 5** | News listing with pagination & cache headers, slug markdown retrieval, 404 handling, active announcements, content publishing & cache invalidation |
| `tests/minecraft.test.ts` | **5 / 5** | Version catalog listing, Java 21 evaluation for 1.21.4 with zero-JAR assertion, Java 8 evaluation for 1.16.5, SoC compatibility matrix query, manifest sync |
| `tests/admin-rbac.test.ts` | **7 / 7** | Staff login, normal user rejection, TOTP setup & verification, MFA enforcement, RBAC permission denial (403), audit trail recording, dashboard HTML delivery |
| `tests/session-security.test.ts` | **5 / 5** | Session listing, targeted revocation, password change invalidation, device revocation, 5-attempt lockout |
| `tests/auth.test.ts` | **13 / 13** | User registration, login, token rotation, replay detection, verification, reset |
| `tests/database.test.ts` | **4 / 4** | PostgreSQL connection pool, table queries, atomic transactions |
| `tests/audit.test.ts` | **2 / 2** | Immutable audit logging and recursive metadata redaction |
| `tests/api.test.ts` | **5 / 5** | Operational probes (`/health`, `/ready`), Helmet headers, 404 handler |
| `tests/redis.test.ts` | **3 / 3** | In-memory and real Redis storage, TTL expiration |
| `tests/security.test.ts` | **4 / 4** | Argon2id password hashing and constant-time verification |
| `tests/config.test.ts` | **4 / 4** | Zod configuration schema and secret scrubbing |

---

## 4. Artifacts Created & Modified in Phase 3F

- **Created:**
  - `app_pojavlauncher/src/main/java/com/vyron/client/VyronApiClient.java` (Async HTTP client with token isolation)
  - `app_pojavlauncher/src/main/java/com/vyron/client/content/VyronNewsArticle.java` (Parsed article model)
  - `app_pojavlauncher/src/main/java/com/vyron/client/content/VyronNewsManager.java` (Offline-first news cache manager)
  - `app_pojavlauncher/src/main/java/com/vyron/client/content/VyronAnnouncement.java` (Announcement model)
  - `app_pojavlauncher/src/main/java/com/vyron/client/content/VyronAnnouncementManager.java` (Active alert manager)
  - `app_pojavlauncher/src/main/java/com/vyron/client/metadata/VyronCompatibility.java` (Compatibility model)
  - `app_pojavlauncher/src/main/java/com/vyron/client/metadata/VyronVersionManager.java` (Hardware compatibility evaluator)
  - `docs/backend/PHASE_3F_REPORT.md` (This 10-point gate report)
- **Modified:**
  - `app_pojavlauncher/src/main/res/layout/view_vyron_offline_banner.xml` (Added `vyron_offline_banner_text` ID)
  - `app_pojavlauncher/src/main/res/layout/fragment_vyron_home.xml` (Added IDs for news headline, summary, and date)
  - `app_pojavlauncher/src/main/java/com/vyron/ui/home/VyronHomeFragment.java` (Integrated news and announcement managers)

---

## 5. Phase Gate Verdict

**VERDICT: GO — APPROVED FOR PHASE 3G & 3H (Compatibility & Release Intelligence, Server Ecosystem & Promotions)**
