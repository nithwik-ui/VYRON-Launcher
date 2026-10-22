# VYRON Identity & Account Architecture

## 1. Architectural Invariant: Identity Isolation

The VYRON Launcher strictly enforces three non-overlapping identity boundaries:

```text
┌───────────────────────────┐      ┌───────────────────────────┐      ┌───────────────────────────┐
│       VYRON Identity      │      │     Microsoft Identity    │      │    Local Offline Profile  │
│  - Cloud sync & profile   │      │  - Official Java Edition  │      │  - Local offline gameplay │
│  - Multiplayer tickets    │      │  - MSA OAuth, XBL, XSTS   │      │  - LAN multiplayer        │
│  - Argon2id / Keystore    │      │  - Hardware Keystore only │      │  - Offline servers        │
│  - Backend: Fastify/Pg    │      │  - NEVER sent to backend  │      │  - No online verification │
└───────────────────────────┘      └───────────────────────────┘      └───────────────────────────┘
```

### Critical Rules
- **No Token Mixing:** VYRON JWT access tokens and refresh tokens are completely separate from Microsoft/Mojang OAuth and Minecraft Services tokens.
- **No Fake Ownership:** A VYRON account does NOT claim or grant Microsoft Minecraft ownership. Official Microsoft ownership verification via Mojang entitlements remains untouched.
- **Hardware Vault Isolation:** Microsoft refresh tokens and access tokens are stored exclusively on-device in AndroidKeyStore (`VyronSecureCredentialStore`) and are NEVER transmitted to the VYRON cloud backend.
- **Offline First:** A VYRON account is NEVER mandatory for launching local offline Minecraft instances or playing LAN games.

---

## 2. VYRON Account Model

The authoritative user model in Supabase PostgreSQL (`prisma/schema.prisma`):

```prisma
model User {
  id                      String                   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  username                String                   @unique @db.VarChar(32)
  email                   String                   @unique @db.VarChar(255)
  passwordHash            String                   @map("password_hash") @db.VarChar(255)
  avatarUrl               String?                  @map("avatar_url") @db.VarChar(512)
  bio                     String?                  @db.Text
  isActive                Boolean                  @default(true) @map("is_active")
  isVerified              Boolean                  @default(false) @map("is_verified")
  role                    String                   @default("USER") @db.VarChar(32)
  createdAt               DateTime                 @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt               DateTime                 @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

  sessions                UserSession[]
  devices                 Device[]
  emailVerificationTokens EmailVerificationToken[]
  passwordResetTokens     PasswordResetToken[]
  auditLogs               AuditLog[]
}
```

---

## 3. Registration & 6-Digit Email OTP Workflow

```text
User fills registration form (Username, Email, Password, Confirm Password)
                             ↓
              Client-side validation pass
                             ↓
         POST /api/v1/auth/register (Argon2id Hash)
                             ↓
       Account created (isVerified=false, isActive=true)
                             ↓
       Generate secure 6-digit numeric OTP (100000 - 999999)
                             ↓
       Store OTP in Redis (TTL: 15 mins) + Token in DB
                             ↓
       Dispatch verification email via EmailService
                             ↓
       User enters 6-digit OTP in verification screen
                             ↓
       POST /api/v1/auth/verify-email
                             ↓
       OTP verified & consumed -> Account marked isVerified=true
                             ↓
       Automatic Login & Keystore Session Persistence
```

### Security Safeguards
1. **No Plaintext Leaks:** Plaintext OTPs and passwords are never logged, never returned in production API responses, and never saved in persistent database fields.
2. **Brute-Force Lockout:** More than 5 failed OTP verification attempts triggers an immediate 15-minute lock on verification.
3. **Resend Throttling:** Resend OTP requests enforce a strict 60-second cooldown via Redis rate limiting.
4. **Replay Invalidation:** A successfully consumed OTP or token is invalidated immediately and cannot be reused.

---

## 4. Password Security Standards

- **Algorithm:** Argon2id (memory cost: 65,536 KiB, time cost: 3 iterations, parallelism: 4 threads).
- **Salt:** 16 cryptographically secure random bytes generated per password.
- **Log Sanitation:** Passwords, password hashes, reset tokens, and OTPs are redacted in Fastify Pino loggers and excluded from exception messages.

---

## 5. Persistent Device Sessions & Android Keystore

- **Access Token:** Short-lived signed JWT (15-minute expiration).
- **Refresh Token:** Cryptographically secure 256-bit opaque random token with rolling 30-day expiration.
- **Rotation & Replay Detection:** Every refresh rotates the refresh token. If a previously consumed or revoked refresh token is presented, the backend triggers an automatic security cascade, revoking all active sessions for that user across all devices.
- **Client Vault:** On Android, session tokens are stored in `VyronSessionManager` utilizing AES-256-GCM authenticated encryption backed by the Android hardware KeyStore.
