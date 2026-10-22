# VYRON Phase 3B — Android Authentication & Security Audit

## Executive Summary
This document provides a comprehensive security inventory of all authentication, credential persistence, network authorization, and session artifacts within the VYRON Minecraft Launcher Android application (`app_pojavlauncher`). Every occurrence of token, secret, session, and credential material has been analyzed, categorized, and audited against the hardened security baseline established in Phase 3B.

---

## 1. Security Classification Methodology
Each identified security item is categorized according to the following taxonomy:

- **SAFE**: Non-sensitive operational metadata or public identifiers that do not grant account authorization or compromise user privacy.
- **SENSITIVE**: Cryptographic tokens, session keys, or refresh material that could allow unauthorized account impersonation or access.
- **MUST MOVE**: Network or cryptographic operations previously executed on the main/UI thread that must be moved to asynchronous background execution.
- **MUST ENCRYPT**: Sensitive credentials at rest that must be stored in hardware-backed Keystore / AES-256-GCM encrypted vaults instead of plaintext JSON.
- **MUST NOT LOG**: Tokens, authorization headers, or OAuth payloads that must be sanitized from logcat, error messages, and exception dumps.
- **LEGACY**: Unencrypted on-disk structures or deprecated methods that require transparent, idempotent migration to secure storage.

---

## 2. Comprehensive Credential & Token Inventory

| Component / File | Field / Keyword | Audit Finding | Classification | Phase 3B Hardening Action |
| :--- | :--- | :--- | :--- | :--- |
| `MinecraftAccount.java` | `msaRefreshToken` | Microsoft OAuth refresh token (valid up to 90 days). Previously written in plaintext JSON to `/data/data/.../accounts/<name>.json`. | **SENSITIVE**, **MUST ENCRYPT**, **MUST NOT LOG**, **LEGACY** | Extracted from plaintext JSON. Encrypted at rest into `secure_vault/<hex>.vault` via AES-256-GCM. Replaced on disk with placeholder `"SECURED"`. |
| `MinecraftAccount.java` | `accessToken` | Minecraft bearer token (1-day validity). Transmitted in HTTP Authorization headers. Previously written in plaintext JSON. | **SENSITIVE**, **MUST ENCRYPT**, **MUST NOT LOG**, **LEGACY** | Encrypted into `secure_vault`. Disk serialized value sanitized to `"SECURED"`. Restored into memory only when needed by game engine. |
| `MinecraftAccount.java` | `xuid` | Xbox User ID (numeric user identity). Persisted in plaintext. | **SENSITIVE**, **MUST ENCRYPT**, **MUST NOT LOG** | Moved into encrypted `AccountCredentials` vault. Nullified in disk JSON. |
| `MinecraftAccount.java` | `clientToken` | Legacy client session identifier. Persisted in plaintext. | **SENSITIVE**, **MUST ENCRYPT** | Encrypted in `AccountCredentials` vault. |
| `MinecraftAccount.java` | `profileId` | Minecraft UUID (public identity). | **SAFE** | Kept in `accounts/<name>.json` for profile identification, skin caching, and skin rendering. |
| `MinecraftAccount.java` | `username` | In-game player display name. | **SAFE** | Kept in `accounts/<name>.json` and UI models. |
| `MinecraftAccount.java` | `isMicrosoft` | Boolean flag distinguishing Microsoft vs Local offline account. | **SAFE** | Preserved for engine routing and offline execution checks. |
| `MinecraftAccount.java` | `skinFaceBase64` | Base64-encoded PNG head icon. | **SAFE** | Preserved in JSON for instant offline UI rendering without remote HTTP fetches. |
| `MinecraftAccount.java` | `updateSkinFace()` | Synchronous HTTP networking inside model class. Called directly during account rendering. | **MUST MOVE** | Guarded by thread check: if called on UI thread, automatically offloaded to `PojavApplication.sExecutorService`. |
| `MicrosoftBackgroundLogin.java` | `authcode` | OAuth authorization code received from Microsoft browser callback. Previously logged to logcat: `Log.d(TAG, authcode)`. | **SENSITIVE**, **MUST NOT LOG** | Log call permanently stripped. Auth code processed in memory and immediately discarded after token exchange. |
| `MicrosoftBackgroundLogin.java` | `formData` | URL-encoded POST payload containing `client_id`, `code`, `code_verifier`, and `redirect_uri`. Previously logged: `Log.d(TAG, formData)`. | **SENSITIVE**, **MUST NOT LOG** | Log call permanently stripped. |
| `MicrosoftBackgroundLogin.java` | `access_token` | Microsoft Live OAuth token received from `login.live.com/oauth20_token.srf`. Previously logged: `Log.d(TAG, "Access token: " + ...)`. | **SENSITIVE**, **MUST NOT LOG** | Log call permanently stripped. Token never printed to logcat or saved to disk; used strictly in-flight for Xbox Live exchange. |
| `MicrosoftBackgroundLogin.java` | `Token` (XBL / XSTS) | Xbox Live and XSTS authorization tokens. Previously logged: `Log.d(TAG, "Token: " + ...)`. | **SENSITIVE**, **MUST NOT LOG** | Log call permanently stripped. Tokens used in-flight to acquire Minecraft authorization. |
| `MicrosoftBackgroundLogin.java` | `req` (JSON Request) | JSON payload sent to `api.minecraftservices.com/authentication/login_with_xbox` containing `identityToken`. Previously logged: `Log.d(TAG, req)`. | **SENSITIVE**, **MUST NOT LOG** | Log call permanently stripped. Request kept private in memory. |
| `MicrosoftBackgroundLogin.java` | `xsts` (Response) | JSON response containing Xbox token and userhash. Previously logged: `Log.d(TAG, "XSTS response: " + ...)`. | **SENSITIVE**, **MUST NOT LOG** | Log call permanently stripped. |
| `MicrosoftBackgroundLogin.java` | `profile` (Response) | JSON response from Minecraft services containing UUID and skins. Previously logged: `Log.d(TAG, "Profile response: " + ...)`. | **SENSITIVE**, **MUST NOT LOG** | Log call sanitized: only player name is logged; raw JSON payload stripped. |
| `mcAccountSpinner.java` | `performLogin()` | UI spinner dropdown initiating background login and account removal directly from View layer. | **MUST MOVE** | Decoupled from View: delegated to `VyronAccountRepository.performMicrosoftLogin()` and `VyronAccountRepository.removeAccount()`. |
| `mcAccountSpinner.java` | `mAccountList` | List of local accounts populated synchronously in UI constructors. | **SAFE** | Retained with non-sensitive metadata only (`username`, `profileId`, `isMicrosoft`). |
| `AccountCredentials.java` | `toString()` | Default serialization could leak tokens if printed during debug sessions. | **MUST NOT LOG** | Custom `toString()` implemented: redaction masks secrets and only reports boolean presence `[hasRefresh=true, hasAccess=true]`. |
| `AndroidManifest.xml` | `allowBackup` | Android backup system could package private app directory including tokens to cloud/ADB. | **MUST NOT LOG**, **SENSITIVE** | Hardened via `data_extraction_rules.xml` (API 31+) and `backup_rules.xml` (legacy): explicitly excludes `secure_vault/` and `accounts/`. |

---

## 3. Storage Hierarchy Comparison

```
LEGACY INSECURE STORAGE (PRE-3B):
/data/data/com.vyron.launcher/
└── files/
    └── accounts/
        └── Player.json  <-- PLAINTEXT: msaRefreshToken, accessToken, xuid exposed to backup / rooted inspection

HARDENED VYRON ARCHITECTURE (PHASE 3B):
/data/data/com.vyron.launcher/
├── files/
│   ├── accounts/
│   │   └── Player.json  <-- SANITIZED METADATA ONLY:
│   │                        {
│   │                          "username": "Player",
│   │                          "isMicrosoft": true,
│   │                          "profileId": "...",
│   │                          "msaRefreshToken": "SECURED",
│   │                          "accessToken": "SECURED"
│   │                        }
│   └── secure_vault/
│       └── <hex-encoded-hash>.vault  <-- AES-256-GCM ENCRYPTED
│                                         Authenticated by AndroidKeyStore Hardware Master Key
│                                         (Excluded from all Android backups)
```

---

## 4. Leakage Vector Audit

1. **Logcat / Crash Reporting Leakage**:
   - Status: **ELIMINATED**.
   - Verified that `MicrosoftBackgroundLogin.java` has all secret log statements deleted.
   - Verified that `AccountCredentials.toString()` never emits raw token strings.

2. **Android Cloud / ADB Backup Leakage**:
   - Status: **ELIMINATED**.
   - Configured `android:dataExtractionRules="@xml/data_extraction_rules"` and `android:fullBackupContent="@xml/backup_rules"`.
   - Explicitly excludes `secure_vault/` and `accounts/` across cloud, device-to-device, and local ADB extraction.

3. **Disk At-Rest Inspection**:
   - Status: **HARDENED**.
   - All credentials protected with AES-256-GCM with 128-bit authentication tags and unique 96-bit IVs generated per write via `SecureRandom`.

4. **UI Thread Blocking**:
   - Status: **RESOLVED**.
   - `updateSkinFace()` safely offloaded from UI thread.
   - `mcAccountSpinner` background operations dispatched through `VyronAccountRepository` background threads.
