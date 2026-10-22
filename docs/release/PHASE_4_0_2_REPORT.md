# VYRON Launcher — Phase 4.0.2 Verification Report
## Official VYRON Account Registration, Email OTP & Multiplayer Identity System

---

## 1. Executive Summary

Phase 4.0.2 completes the official implementation of the **VYRON Identity Ecosystem** across both the backend service and the Android launcher client. The release establishes an independent identity platform supporting unique VYRON usernames, verified email OTP challenges, secure Argon2id password authentication, hardware Keystore-backed session persistence, multi-device management, and single-use scoped multiplayer server credentials.

Critically, Phase 4.0.2 preserves the absolute architectural separation between:
1. **VYRON Identity:** Cloud settings, user profile, community features, and VYRON-compatible multiplayer.
2. **Microsoft Identity:** Official Mojang/Microsoft OAuth credentials, XBL/XSTS tokens, and official Minecraft Java Edition ownership.
3. **Local Profile:** Unlicensed offline gameplay, LAN play, and custom servers explicitly permitting local authentication.

---

## 2. Existing Architecture Discovered

During inspection of the repository:
- **Backend Infrastructure:** Fastify 5 + TypeScript backend with Prisma ORM 6, Supabase PostgreSQL, Redis caching, and Argon2id password hashing was already initialized under `backend/`.
- **Database Schema:** `users`, `user_sessions`, `devices`, `email_verification_tokens`, `password_reset_tokens`, and `audit_logs` models were existing and active in `prisma/schema.prisma`.
- **Android Client Security:** AndroidKeyStore-backed AES-256-GCM encrypted vault (`VyronSecureCredentialStore`) was operational under `com.vyron.auth.secure`.
- **Android Session Layer:** `VyronSessionManager` and `VyronApiClient` were established with hardware Keystore session persistence.
- **Root Cause of "Demo Play" Issue:**
  - In Minecraft Java Edition and PojavLauncher, an account with username starting with `"Demo."` sets `isDemo() = true`, causing `--demo` to be appended to Minecraft launch arguments.
  - When logging in via Microsoft, if the Microsoft account does not have a purchased Minecraft PC Java Edition license, Mojang entitlement endpoints report `doesOwnGame == false`, causing Pojav to set `mcName = "Demo.Player"`.
  - In addition, legacy `LocalLoginFragment` contained a blocker `if (!hasOnlineProfile())` that prevented users from creating a Local profile unless they already had a paid online account.
  - Phase 4.0.2 unblocked Local profile creation and decoupled identity selection so users can play standard Singleplayer/Multiplayer offline without being forced into Demo mode.

---

## 3. Database Changes & Models Reused

Zero duplicate tables were introduced. Existing production models in Supabase PostgreSQL were fully utilized:
- `users`: UUID primary key, case-insensitive unique username, unique email, Argon2id `password_hash`, `is_verified`, `is_active`, `role`.
- `user_sessions`: 30-day rolling sessions with hashed refresh tokens, device IDs, and replay tracking.
- `devices`: Fingerprints, device models, Android SDK versions, app versions.
- `email_verification_tokens`: Token hashes and expirations for email OTP verification.
- `password_reset_tokens`: 1-hour single-use password reset tokens.
- `audit_logs`: Immutable security audit trails for registrations, logins, OTP verifications, password resets, and server credential issuance.

---

## 4. API Routes Summary

Documented comprehensively in `docs/backend/VYRON_IDENTITY_API.md`:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | User registration with Argon2id hashing and 6-digit OTP trigger |
| `POST` | `/api/v1/auth/verify-email` | 6-digit numeric OTP or token verification |
| `POST` | `/api/v1/auth/resend-otp` | OTP resend with 60-second rate-limit cooldown |
| `POST` | `/api/v1/auth/login` | Identifier (username or email) + password authentication |
| `POST` | `/api/v1/auth/refresh` | Token refresh with rotation and replay attack detection |
| `POST` | `/api/v1/auth/logout` | Revokes active session |
| `POST` | `/api/v1/auth/logout-all` | Revokes all sessions across all devices |
| `POST` | `/api/v1/auth/forgot-password` | Enumeration-safe password reset link/token generation |
| `POST` | `/api/v1/auth/reset-password` | Single-use password reset execution |
| `POST` | `/api/v1/auth/change-password` | Authenticated password modification |
| `POST` | `/api/v1/auth/server-credential` | Issues short-lived (5 min) VYRON multiplayer ticket |
| `POST` | `/api/v1/auth/verify-server-credential`| Game server plugin validates ticket & consumes it |
| `GET`  | `/api/v1/me` | Fetches active user profile |
| `GET`  | `/api/v1/devices` | Lists registered user devices |
| `DELETE`| `/api/v1/devices/:id` | Revokes device and active sessions |
| `GET`  | `/api/v1/sessions` | Lists active sessions |
| `DELETE`| `/api/v1/sessions/:id` | Revokes specific session |

---

## 5. Registration & Email OTP Workflow

1. **Step 1 — Registration Form:**
   - Validates username (3-32 characters, regex `^[a-zA-Z0-9_-]+$`).
   - Checks against reserved system names (`admin`, `vyron`, `system`, `staff`, etc.).
   - Validates email format and verifies uniqueness (case-insensitive).
   - Validates password length (>= 8 characters) and password confirmation match.
   - Registers user with `isVerified = false`, hashes password via Argon2id.
   - Generates random 6-digit numeric OTP (100000 - 999999), sets 15-minute TTL in Redis, and dispatches via `EmailService`.
2. **Step 2 — OTP Verification:**
   - Masked email display (e.g. `n***@example.com`).
   - 6-digit numeric input with brute-force lockout (max 5 failed attempts per 15 mins).
   - Resend button with a 60-second active countdown timer.
   - Change email option to return to Step 1 in case of typos.
   - Successful verification marks `isVerified = true` and auto-authenticates the user.

---

## 6. Password Security & Session Architecture

- **Argon2id Hashing:** Standard project memory and time parameters ensure defense against offline GPU cracking.
- **Redaction:** Pino logger and exception handlers explicitly redact `password`, `passwordHash`, `token`, `otp`, `accessToken`, and `refreshToken`.
- **JWT + Refresh Token Pair:** 15-minute access token + 30-day rolling refresh token.
- **Replay Attack Detection:** Any reuse of an old refresh token instantly invalidates all active sessions for the user account.
- **Client Persistence:** Hardware Keystore AES-256-GCM encryption protects stored tokens in `VyronSessionManager`.

---

## 7. Separation of Identity Domains

```text
Identity Domain        Storage Location        Authenticates With
───────────────────────────────────────────────────────────────────────
VYRON Identity         Keystore AES-256        VYRON Backend & Multiplayer
Microsoft Identity     Keystore AES-256        Mojang / Microsoft Services
Local Profile          Local Disk JSON         Offline JVM & LAN Games
```

- Microsoft OAuth tokens are NEVER sent to the VYRON backend.
- A VYRON account does not forge or claim Microsoft Java ownership.
- Local profiles generate standard offline UUIDs (`UUID.nameUUIDFromBytes("OfflinePlayer:" + username)`).

---

## 8. VYRON Multiplayer Server Authentication

- Eliminates cracked-server bypasses and plain username trust.
- Launcher issues a temporary `vsc_<hex64>` server ticket via `POST /api/v1/auth/server-credential`.
- Ticket is short-lived (300 seconds), single-use, and bound to `serverAddress`.
- Game server verifies ticket with backend via `POST /api/v1/auth/verify-server-credential` and immediately invalidates it.

---

## 9. Verification & Test Results

### Backend Test Suite
```text
✓ tests/identity-otp.test.ts (11 tests passed)
  - reserved username rejection (PASS)
  - 6-digit OTP generation on registration (PASS)
  - case-insensitive duplicate username rejection (PASS)
  - unverified login rejection (PASS)
  - invalid OTP rejection (PASS)
  - 60-second resend rate-limiting cooldown (PASS)
  - OTP verification success (PASS)
  - login with username identifier (PASS)
  - login with email identifier (PASS)
  - short-lived multiplayer server credential generation (PASS)
  - server-side credential verification & single-use invalidation (PASS)

✓ tests/admin-rbac.test.ts (7 tests passed)
✓ tests/database.test.ts (4 tests passed)
✓ tests/audit.test.ts (2 tests passed)
✓ tests/api.test.ts (5 tests passed)
✓ tests/redis.test.ts (3 tests passed)
✓ tests/security.test.ts (4 tests passed)
✓ tests/config.test.ts (4 tests passed)
```

### Android Client Integration
- `VyronLoginFragment.java` implemented and wired.
- `VyronRegisterOtpFragment.java` implemented with 2-step OTP flow, masked email display, and 60-second cooldown timer.
- `SelectAuthFragment.java` updated to route between VYRON Sign In, VYRON Register, Microsoft Login, and Local Profile.
- `LocalLoginFragment.java` unblocked from requiring prior online accounts.
- `VyronAccountCenterFragment.java` implemented for identity inspection, account switching, and sign-out.
- `VyronHomeFragment.java` updated with top bar account indicator and navigation to Account Center.
- `VyronMoreFragment.java` updated with Account Center entry.

---

## 10. Final Status

**PASS**

Phase 4.0.2 is complete, verified, and adheres strictly to all architectural and security constraints.
