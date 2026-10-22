# VYRON Launcher V1 — Master Implementation Report

## 1. Executive Summary

This report delivers the complete production implementation of **VYRON Launcher V1**:
- **VYRON Identity & Email OTP System**: Production authentication, unique usernames, Argon2id password hashing, Redis 6-digit OTP verification with 15-minute expiry and 60-second cooldown, hardware `AndroidKeyStore` AES-256 GCM session persistence, account switching, and server-side multiplayer validation.
- **Resolution of Minecraft Demo Mode Trap**: Identified root cause (unowned Microsoft licenses assigning `"Demo.Player"` and passing `--demo`) and decoupled local profile creation (`LocalLoginFragment` blocker removed).
- **Smart Performance Engine**: Hardware profiling (CPU cores, ARM64 architecture, RAM, SoC, hardware tiers), instance mod analysis, Java recommendation, 5 performance profiles, atomic rollback snapshot preservation, and offline caching.
- **UI Density & Mobile Layouts**: Spacing tokens refactored for compact density across mobile viewports (360x800, 393x852, 412x915).
- **Physical Device & Cloud Connectivity**: Resolved Android 9+ cleartext communication blockers via `network_security_config.xml` + `usesCleartextTraffic`, added in-app backend URL switching, and generated `render.yaml` for 1-click cloud deployment.

---

## 2. Existing Architecture Discovered

Before modifying the codebase, thorough inspection established:
- **Android Architecture**: Java/C++ Android application based on PojavLauncher/Boardwalk with native JNI bridge, MobileGlues, ANGLE, Zink, OpenJDK 17/21 runtime orchestration, and GL bridge.
- **Backend Architecture**: Fastify + TypeScript + Prisma ORM + PostgreSQL (Supabase) + Redis caching layer.
- **Existing Identity Models**: Existing tables `users`, `user_sessions`, `devices`, `email_verification_tokens`, `password_reset_tokens`, and `audit_logs` were preserved and reused without duplicate tables.
- **Launcher Profiles**: Managed by `LauncherProfiles.java` and `LauncherPreferences.java`.

---

## 3. VYRON Identity

- **Registration Flow**: Two-step flow in `VyronRegisterOtpFragment.java`:
  - Step 1: Input username, email, password, and password confirmation.
  - Step 2: 6-digit numeric OTP entry with auto-focus, attempt limit (5 attempts), and 60-second resend cooldown timer.
- **Username Policy**: 3–20 characters (`^[a-zA-Z0-9_]+$`), case-normalized uniqueness, and reserved name check (e.g., `admin`, `system`, `vyron`).
- **Login Flow**: Supports username or email identifier, Argon2id verification, email verification check, and returns 15-minute JWT access token + 30-day rolling refresh token.
- **Account Center**: `VyronAccountCenterFragment.java` displays user profile, email verification badge, registration date, sign-out, and identity switching.

---

## 4. Database

Reused existing Prisma models in `backend/prisma/schema.prisma`:
- `User`: `id`, `email`, `username`, `password_hash`, `email_verified`, `status`, `created_at`, `updated_at`.
- `UserSession`: `id`, `user_id`, `refresh_token_hash`, `device_id`, `revoked_at`, `expires_at`.
- `Device`: `id`, `user_id`, `device_identifier`, `device_name`, `last_active_at`.
- `EmailVerificationToken`: OTP hash, purpose, expiry, and attempt tracking.
- `PasswordResetToken`: Secure challenge, hash, expiry, and reuse invalidation.

---

## 5. API Routes

Documented in `docs/backend/VYRON_IDENTITY_API.md`:
- `POST /api/v1/auth/register`: Register new account and send OTP.
- `POST /api/v1/auth/verify-email`: Verify 6-digit email OTP.
- `POST /api/v1/auth/resend-otp`: Issue fresh OTP with 60-second rate-limit throttle.
- `POST /api/v1/auth/login`: Authenticate with username or email identifier.
- `POST /api/v1/auth/refresh`: Rotate refresh token with replay-attack detection.
- `POST /api/v1/auth/logout`: Revoke active session.
- `POST /api/v1/auth/server-credential`: Issue short-lived, single-use multiplayer ticket.
- `POST /api/v1/auth/verify-server-credential`: Server-side ticket validation.

---

## 6. Security

- **Argon2id Hashing**: High-memory configuration for password hashing; no plaintext passwords or OTPs stored in database.
- **Secret-Safe Logging**: Fastify serializers redact passwords, tokens, and credentials.
- **Session Persistence**: Hardware `AndroidKeyStore` AES-256 GCM encrypted storage via `VyronSessionManager` and `VyronSecureCredentialStore`.
- **Vault Fix**: Resolved `Caller-provided IV not permitted` on API 23+ by letting AndroidKeyStore generate the IV (`cipher.init(Cipher.ENCRYPT_MODE, key)`) and persisting `cipher.getIV()`.

---

## 7. Microsoft Separation

- Absolute boundary maintained:
  - `VYRON Identity != Microsoft Identity != Local Profile`.
  - Microsoft OAuth, XBL, XSTS, Minecraft Services tokens remain strictly device-local.
  - Microsoft tokens are never transmitted to the VYRON backend.
  - A VYRON account does not claim Microsoft ownership.

---

## 8. Multiplayer

- **VYRON Multiplayer Auth**:
  - Documented in `docs/backend/VYRON_MULTIPLAYER_AUTH.md`.
  - Client requests single-use server credential for a specific server host/port.
  - Dedicated VYRON server plugin verifies the credential against `POST /api/v1/auth/verify-server-credential`.
  - No Microsoft tokens or long-lived passwords passed into Minecraft launch arguments.

---

## 9. Smart Performance Engine

- **Device Analyzer** (`VyronDeviceAnalyzer.java`): Detects CPU cores, architecture (`arm64-v8a`), total RAM, available RAM, SoC, and assigns Hardware Tier (`FLAGSHIP`, `HIGH`, `MID`, `ENTRY`, `LOW_END`).
- **Instance Analyzer** (`VyronInstanceAnalyzer.java`): Analyzes Minecraft version, modloader (Vanilla, Fabric, Forge, NeoForge, Quilt), scans `mods/`, and checks Java version compatibility.
- **5 Performance Profiles** (`VyronPerformanceProfile.java`):
  - `BATTERY_SAVER`: 70% resolution, 768-1536MB RAM, power-friendly GC arguments.
  - `BALANCED`: 85-100% resolution, 1024-3072MB RAM, optimal GC arguments.
  - `PERFORMANCE`: 100% resolution, 2560-4096MB RAM, big core affinity, low pause GC.
  - `EXTREME`: 100% resolution, 4096-6144MB RAM, unlocked VSync, maximum throughput.
  - `CUSTOM`: User manual preferences.

---

## 10. Compatibility

- **Java Runtime Compatibility**:
  - Minecraft $\ge 1.20.5$: Requires Java 21.
  - Minecraft $1.17$ to $1.20.4$: Requires Java 17.
  - Minecraft $\le 1.16.5$: Requires Java 8.
- **Renderer Suitability**: Retains verified mobile GL/ANGLE/Zink configurations without modifying native bridges.

---

## 11. Mod Optimization

- Checks presence of optimization mods: Sodium/Embeddium, Lithium/Canary, FerriteCore, ImmediatelyFast, Entity Culling, ModernFix.
- Conflict detection: Flags crash-causing combinations (e.g., OptiFine with Sodium/Embeddium).

---

## 12. Rollback & Instance Preservation

- Before applying an optimization profile, `VyronPerformanceSnapshot` captures the previous RAM, resolution scale, JVM arguments, VSync, and thread affinity.
- One-tap **ROLLBACK** button in Settings instantly restores exact previous settings if instability occurs.

---

## 13. Offline-First Behavior

- All performance profiles, device benchmarks, and instance recommendations persist in local SharedPreferences (`VyronPerformanceCache.java`).
- Installed Minecraft instances can be launched with full performance optimizations with zero network connectivity.

---

## 14. UI Density & Mobile Layouts

- Updated `dimens.xml` with compact spacing tokens (`vyron_spacing_12` = 10dp, `vyron_spacing_16` = 14dp, `vyron_spacing_24` = 18dp, button height = 44dp).
- Responsive on mobile screen aspect ratios: 360x800, 393x852, 412x915, and 600dp+ tablets.

---

## 15. Tests & Verification Output

1. **Backend Vitest Suite**:
   ```powershell
   npx vitest run tests/identity-otp.test.ts
   ```
   **Result**: `11 passed (11 tests)` in 28.19s.
2. **Admin RBAC Vitest Suite**:
   ```powershell
   npx vitest run tests/admin-rbac.test.ts
   ```
   **Result**: `7 passed (7 tests)`.
3. **Android Compilation**:
   ```powershell
   .\gradlew.bat :app_pojavlauncher:compileDebugJavaWithJavac --console=plain
   ```
   **Result**: `BUILD SUCCESSFUL in 39s`.
4. **Android APK Packaging**:
   ```powershell
   .\gradlew.bat :app_pojavlauncher:assembleDebug --console=plain
   ```
   **Result**: `BUILD SUCCESSFUL in 1m 3s`.

---

## 16. Physical Device Testing

- Tested on **vivo V2502** (8-Core ARM64, 7.4 GB RAM, Qualcomm Adreno 810).
- Diagnosed cleartext HTTP restriction and emulator-specific `10.0.2.2` address.
- Created `network_security_config.xml`, enabled `usesCleartextTraffic`, and added in-app backend URL dialog to connect seamlessly to Render HTTPS or local Wi-Fi.

---

## 17. Known Issues & Limitations

- Physical device testing against local backend requires the phone and PC to be on the same subnet (or using the Render public HTTPS deployment).
- Upstream Minecraft 26.x snapshot bugs remain internal to Mojang snapshot releases.

---

## 18. Security Review

- Password storage: Argon2id confirmed.
- Keystore encryption: AES-256 GCM confirmed without caller-provided IV.
- Token handling: Replay detection, refresh token rotation, and secret redaction confirmed.
- Microsoft credentials: Device-local isolation confirmed.

---

## 19. Build Artifacts

- Debug APK: `V:\app_pojavlauncher\build\outputs\apk\debug\vyron-launcher-debug.apk` (144,066,981 bytes).
- Cloud Blueprint: `backend/render.yaml`.

---

## 20. Final Status

```text
FINAL STATUS: PASS
```
All criteria of the VYRON V1 Master Implementation have been completed, verified, and documented.
