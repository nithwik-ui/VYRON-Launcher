# VYRON Phase 3B — Implementation Report
## Android Authentication Architecture & Local Security Hardening

---

## 1. Executive Summary & Status

| Phase | Title | Status | Baseline Commit | Final Verification |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 3B** | Android Authentication Architecture & Local Security Hardening | **PASS (100% COMPLETE)** | `a79d700cd55061813c46bbfe54a155eba118b7ae` | Debug APK generated (142.8 MB), 13/13 Unit Tests Passing |

Phase 3B successfully resolves all High Priority security vulnerabilities identified in the Phase 3A Audit regarding plaintext credential storage, unencrypted OAuth refresh tokens, secret leakage in logcat, Android backup exposure, and UI thread networking. All security enhancements have been implemented strictly on the Android client without altering the Minecraft engine, JNI bridges, or the legitimate Microsoft/Xbox OAuth protocol.

---

## 2. Architecture: What Changed

```
PREVIOUS ARCHITECTURE (VULNERABLE):
[ UI / mcAccountSpinner ] 
         │ (Direct network calls on UI thread, direct JSON manipulation)
         ▼
[ accounts/<user>.json ] (PLAINTEXT: msaRefreshToken, accessToken, xuid)
         ▼
[ Minecraft Engine / Launch ]

PHASE 3B HARDENED ARCHITECTURE:
[ UI / Fragment / Activity / mcAccountSpinner ]
         │
         ▼
[ VyronAccountRepository ] ─── (Background Async Threading, State Tracking)
         │
         ├─── [ VyronSecureCredentialStore ] (AES-256-GCM + AndroidKeyStore)
         │             │
         │             ▼
         │       [ secure_vault/<hash>.vault ] (Encrypted Vault)
         │
         ├─── [ accounts/<user>.json ] (Sanitized Metadata: "SECURED" placeholders)
         │
         ▼
[ Legitimate Microsoft OAuth Pipeline ]
         │
         ▼
[ Minecraft Engine / Launch ] (Unchanged JNI & Native Bridge Compatibility)
```

### Key Architectural Upgrades:
1. **Separation of Concerns**: UI widgets (`mcAccountSpinner`) no longer perform HTTP networking, token exchange, or direct account file mutations. They delegate to `VyronAccountRepository`.
2. **Explicit Authentication State Machine**: Introduced `AccountAuthState` enum (`AUTHENTICATED`, `TOKEN_EXPIRED`, `TOKEN_REFRESHING`, `AUTHENTICATION_REQUIRED`, `OFFLINE_LOCAL`, `DEMO`, `ERROR`) allowing deterministic UI state rendering without raw exceptions.
3. **Hardware-Backed Encryption**: Integrated AndroidKeyStore with AES-256-GCM authenticated encryption (128-bit authentication tag, 96-bit random IV per write) for OAuth refresh tokens and session material.
4. **Transparent In-Memory Decryption**: The Minecraft engine continues to receive decrypted tokens in memory at launch time without any JNI or native launcher changes.
5. **Sanitized On-Disk Metadata**: Account JSON files now contain only non-sensitive metadata (`username`, `profileId`, `skinFaceBase64`), with sensitive fields redacted to `"SECURED"`.

---

## 3. Files Added and Modified

### Added Files (New Modules & Configuration):
1. `app_pojavlauncher/src/main/java/com/vyron/auth/secure/AccountCredentials.java`:
   - Data model encapsulating `msaRefreshToken`, `accessToken`, `xuid`, `clientToken`, and `expiresAt`.
   - Custom `toString()` with mandatory secret redaction to prevent accidental logging.
2. `app_pojavlauncher/src/main/java/com/vyron/auth/secure/CredentialStorageException.java`:
   - Strongly-typed security exception for vault read/write/decryption failures.
3. `app_pojavlauncher/src/main/java/com/vyron/auth/secure/VyronSecureCredentialStore.java`:
   - AES-256-GCM authenticated vault with AndroidKeyStore integration.
   - Atomic file commit via temporary staging files and file descriptor sync.
   - Built-in software key fallback for local JVM unit test compatibility.
4. `app_pojavlauncher/src/main/java/com/vyron/auth/model/AccountAuthState.java`:
   - Explicit authentication lifecycle enum.
5. `app_pojavlauncher/src/main/java/com/vyron/auth/repository/AuthCallback.java`:
   - Clean asynchronous callback interface for authentication flows.
6. `app_pojavlauncher/src/main/java/com/vyron/auth/repository/AccountChangeListener.java`:
   - Listener interface for reactive account switching and selection.
7. `app_pojavlauncher/src/main/java/com/vyron/auth/repository/VyronAccountRepository.java`:
   - Core repository coordinating account lifecycle, background token refresh, legacy migration, and account switching.
8. `app_pojavlauncher/src/main/res/xml/backup_rules.xml`:
   - Legacy Android backup descriptor excluding `secure_vault/` and `accounts/`.
9. `app_pojavlauncher/src/main/res/xml/data_extraction_rules.xml`:
   - Android 12+ (API 31+) extraction rules strictly preventing cloud and device-to-device credential backup.
10. `app_pojavlauncher/src/test/java/com/vyron/auth/VyronAccountLifecycleTest.java`:
    - 5 unit tests verifying account classification, credential expiration, and secret redaction.
11. `app_pojavlauncher/src/test/java/com/vyron/auth/VyronSecureCredentialStoreTest.java`:
    - 6 unit tests verifying write, read, update, delete, missing credentials, and corruption recovery.
12. `app_pojavlauncher/src/test/java/com/vyron/auth/VyronAccountMigrationTest.java`:
    - 2 unit tests verifying full migration lifecycle and idempotency.

### Modified Files:
1. `app_pojavlauncher/src/main/AndroidManifest.xml`:
   - Added `android:dataExtractionRules="@xml/data_extraction_rules"` and `android:fullBackupContent="@xml/backup_rules"`.
2. `app_pojavlauncher/src/main/java/net/kdt/pojavlaunch/value/MinecraftAccount.java`:
   - `save()`: Encrypts sensitive fields into `VyronSecureCredentialStore` and serializes sanitized `"SECURED"` placeholder JSON to disk.
   - `load()`: Decrypts tokens from vault; detects legacy plaintext accounts and triggers automatic self-healing migration.
   - `updateSkinFace()`: Detects main thread execution and automatically offloads HTTP requests to background thread.
   - `isLocal()`: Distinguishes Microsoft accounts from local offline accounts.
3. `app_pojavlauncher/src/main/java/net/kdt/pojavlaunch/authenticator/microsoft/MicrosoftBackgroundLogin.java`:
   - Completely sanitized: removed all logcat logging of `authcode`, `formData`, `access_token`, `Token` (XBL), `req`, `xsts`, and raw profile JSON payloads.
4. `app_pojavlauncher/src/main/java/com/kdt/mcgui/mcAccountSpinner.java`:
   - Decoupled network and account deletion operations from View layer; delegated to `VyronAccountRepository`.
5. `app_pojavlauncher/src/main/java/net/kdt/pojavlaunch/PojavApplication.java`:
   - Exposed global application context safely for credential store initialization.
6. `app_pojavlauncher/build.gradle`:
   - Added `testImplementation "junit:junit:4.13.2"` for local JVM unit test suite.

---

## 4. Storage Comparison: Old vs New

| Attribute | Old Storage (Phase 3A Baseline) | New Storage (Phase 3B Hardened) |
| :--- | :--- | :--- |
| **Path** | `/data/data/.../accounts/<name>.json` | `accounts/<name>.json` + `secure_vault/<hash>.vault` |
| **Refresh Token (`msaRefreshToken`)** | Plaintext in JSON file | Encrypted (AES-256-GCM) in secure vault; disk JSON contains `"SECURED"` |
| **Access Token (`accessToken`)** | Plaintext in JSON file | Encrypted (AES-256-GCM) in secure vault; disk JSON contains `"SECURED"` |
| **Xbox ID (`xuid`)** | Plaintext in JSON file | Encrypted (AES-256-GCM) in secure vault; disk JSON contains `null` |
| **Non-Sensitive Profile Data** | In JSON file | Preserved in JSON file (`username`, `profileId`, `skinFaceBase64`) |
| **Key Management** | None | Hardware-backed `AndroidKeyStore` (`AES/GCM/NoPadding`, 256-bit key) |
| **Integrity Protection** | None (susceptible to tampering) | 128-bit GCM authentication tag verifying ciphertext authenticity |
| **Android Backup** | Unrestricted (vulnerable to ADB/cloud leaks) | Explicitly excluded via `data_extraction_rules.xml` & `backup_rules.xml` |

---

## 5. Migration Strategy & Behavior

Existing users upgrading to Phase 3B will retain their accounts seamlessly without being logged out.

```
Migration Execution Sequence:
1. MinecraftAccount.load(accountName) called.
2. Read accounts/<accountName>.json.
3. Inspect msaRefreshToken and accessToken.
4. If values are present and != "SECURED":
     a. Extract legacy tokens.
     b. Write to VyronSecureCredentialStore.storeCredentials(name, credentials).
     c. Read back from vault to verify cryptographic integrity.
     d. Only after verification, write sanitized JSON to disk with "SECURED".
5. Populate in-memory MinecraftAccount with decrypted credentials.
```

- **Idempotent**: Migrated files with `"SECURED"` placeholders are skipped on future loads.
- **Crash-Safe**: Legacy plaintext values are never stripped from disk until the vault write is fully committed and verified.
- **Zero Invalidation**: No user accounts or login sessions are lost during upgrade.

---

## 6. What Remained Unchanged

To protect the Minecraft engine and production stability, the following were intentionally kept intact:
- JNI namespace: `net.kdt.pojavlaunch` preserved.
- Native bridges: `jre_launcher.c`, `input_bridge_v3.c`, `egl_bridge.c`, `gl_bridge.c` untouched.
- Native game execution: `MainActivity` and game process architecture untouched.
- Minecraft Instance Configuration: `launcher_profiles.json` remains the sole authoritative instance configuration.
- Microsoft Authentication Protocol: Live OAuth and Xbox Live device token exchange protocol preserved exactly as designed by Microsoft.
- Profile Persistence: `pojav_profile.xml` and key `file` preserved.
- Offline Capability: Complete autonomous offline gameplay without network or backend requirements.

---

## 7. Security Threats Addressed

1. **CWE-312 (Cleartext Storage of Sensitive Information)**: **RESOLVED**. Plaintext refresh tokens, access tokens, and XUIDs encrypted at rest with hardware-backed AES-256-GCM.
2. **CWE-532 (Insertion of Sensitive Information into Log File)**: **RESOLVED**. All authorization codes, form bodies, bearer tokens, and JWT tokens removed from logcat statements.
3. **CWE-538 (Data Leaks through Cloud/ADB Backups)**: **RESOLVED**. Excluded sensitive folders from automatic cloud and local backup.
4. **CWE-400 (Resource Exhaustion / Main Thread Stalls)**: **RESOLVED**. Skin downloads and authentication requests moved off the UI thread.

---

## 8. Threading & Concurrency Hardening

- **`MinecraftAccount.updateSkinFace()`**:
  - Previously: Made synchronous `HttpURLConnection` requests on the calling thread, blocking the UI when rendering account lists.
  - Now: Checks `Looper.myLooper() == Looper.getMainLooper()`. If called on main thread, immediately dispatches the task to `PojavApplication.sExecutorService`.
- **`mcAccountSpinner`**:
  - Previously: Performed login dialogs, background login tasks, and account file writes directly inside UI event listeners.
  - Now: Dispatches operations via `VyronAccountRepository`, posting UI updates back via `mHandler.post(...)`.

---

## 9. Test Suite Verification

### Unit Tests Executed:
`gradlew.bat :app_pojavlauncher:testDebugUnitTest --console=plain`

Results:
```
BUILD SUCCESSFUL in 2m 7s
36 actionable tasks: 4 executed, 32 up-to-date

Test Suites:
1. com.vyron.auth.VyronAccountLifecycleTest:
   - testDemoAccountIdentity: PASSED
   - testCredentialExpiryEvaluation: PASSED
   - testLocalAccountIdentity: PASSED
   - testMicrosoftAccountIsNotLocal: PASSED
   - testAccountCredentialsRedactsSecretsInToString: PASSED
   Result: 5/5 PASSED (100%)

2. com.vyron.auth.VyronSecureCredentialStoreTest:
   - testWriteAndReadCredentials: PASSED
   - testUpdateCredentials: PASSED
   - testMissingCredentialsReturnsNull: PASSED
   - testRemoveCredentials: PASSED
   - testCorruptedVaultFileThrowsException: PASSED
   - testEmptyAccountNameThrowsException: PASSED
   Result: 6/6 PASSED (100%)

3. com.vyron.auth.VyronAccountMigrationTest:
   - testLegacyAccountMigrationLifecycle: PASSED
   - testMigrationIdempotency: PASSED
   Result: 2/2 PASSED (100%)

TOTAL TESTS: 13 / 13 PASSED (100% SUCCESS RATE)
```

---

## 10. Build Verification

Build Command:
`gradlew.bat :app_pojavlauncher:assembleDebug --console=plain`

Result:
```
BUILD SUCCESSFUL in 1m 54s
90 actionable tasks: 29 executed, 61 up-to-date

Artifact Produced:
app_pojavlauncher/build/outputs/apk/debug/app_pojavlauncher-debug.apk
Size: 142,871,785 bytes (142.8 MB)
```
- Compilation: `compileDebugJavaWithJavac` clean.
- DEX Generation: `mergeProjectDexDebug` clean.
- NDK Builds: arm64-v8a, armeabi-v7a, x86, x86_64 clean.
- Packaging: `packageDebug` clean.

---

## 11. Regression Testing Summary

| Test Case | Verification Path | Result |
| :--- | :--- | :--- |
| **Clean Launcher Boot** | Launcher starts -> Main Menu -> Navigation | **PASS** |
| **Instance Selection** | Select instance -> `launcher_profiles.json` resolution | **PASS** |
| **Offline Autonomous Play** | Offline launch -> no internet -> game starts | **PASS** |
| **Microsoft Account Migration** | Legacy JSON detected -> migrated to vault -> sanitized | **PASS** |
| **Account Switching** | Switch account -> loads correct credentials without cross-contamination | **PASS** |
| **Multi-Account State** | Multiple local and Microsoft accounts coexist safely | **PASS** |
| **Account Removal** | Remove account -> clears sanitized JSON and encrypted vault | **PASS** |

---

## 12. Known Residual Risks & Edge Cases

1. **Pre-API 23 Devices**:
   - Devices running Android 5.0 - 5.1 (API 21-22) lack AndroidKeyStore AES key generation support.
   - Mitigation: `VyronSecureCredentialStore` automatically uses a protected 256-bit software key with file descriptor synchronization, ensuring encryption at rest even on legacy devices.
2. **Rooted Devices with Memory Scrapers**:
   - In-memory tokens are necessary while launching the Minecraft engine process. Memory-scraping root tools could theoretically read tokens from RAM.
   - This is inherent to Android JVM architecture and addressed in Phase 4 via process isolation hardening.

---

## 13. Scope Boundaries & Next Phase

- **Completed in Phase 3B**:
  - Android client-side credential encryption (AES-256-GCM + Keystore).
  - UI decoupling via `VyronAccountRepository`.
  - Elimination of secret logging in logcat.
  - Backup exclusion rules.
  - Safe, idempotent legacy account migration.
  - Asynchronous background threading for skin/auth networking.
- **Explicitly Deferred to Phase 3C**:
  - Fastify backend server.
  - PostgreSQL database and Prisma migrations.
  - Redis cache and session management.
  - VYRON user registration/login endpoints.
- **Explicitly Deferred to Later Phases**:
  - Cloud skin sync.
  - Cloud world backup.
  - Server directory backend.
  - Control Center admin dashboard.
