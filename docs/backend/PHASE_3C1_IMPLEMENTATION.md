# VYRON Phase 3C.1 — Backend Foundation Implementation

## Overview

VYRON Phase 3C.1 establishes the production backend foundation and database infrastructure for the VYRON Minecraft Java Launcher ecosystem. It implements the initial modular monolith architecture using Node.js, TypeScript, and Fastify, integrating managed PostgreSQL 17 via Supabase, with an ephemeral Redis state abstraction, strict configuration validation, Argon2id security controls, standardized API envelopes, and immutable audit logging.

---

## Architecture Summary

```
                      +-----------------------------+
                      |       VYRON Backend         |
                      |   (Fastify Modular Monolith)|
                      +--------------+--------------+
                                     |
              +----------------------+----------------------+
              |                                             |
   (Primary Relational)                              (Ephemeral State)
              v                                             v
+-----------------------------+               +-----------------------------+
|    PostgreSQL 17 DB         |               |     Redis / Ephemeral       |
|    (Supabase Managed)       |               |     In-Memory Fallback      |
+-----------------------------+               +-----------------------------+
|  users                      |               | Rate limiting buckets       |
|  user_sessions              |               | Replay protection cache     |
|  oauth_accounts             |               | Password reset throttles    |
|  devices                    |               | Verification state          |
|  email_verification_tokens  |               +-----------------------------+
|  password_reset_tokens      |
|  audit_logs                 |
+-----------------------------+
```

---

## 1. Directory Structure

```
backend/
|-- .env.example
|-- .gitignore
|-- package.json
|-- tsconfig.json
|-- vitest.config.ts
|-- prisma/
|   `-- schema.prisma
|-- src/
|   |-- app.ts
|   |-- server.ts
|   |-- config/
|   |   `-- env.ts
|   |-- db/
|   |   `-- prisma.ts
|   |-- redis/
|   |   `-- client.ts
|   |-- common/
|   |   |-- errors/
|   |   |   |-- app-error.ts
|   |   |   `-- error-handler.ts
|   |   `-- security/
|   |       `-- password.ts
|   `-- modules/
|       |-- health/
|       |   |-- health.service.ts
|       |   `-- health.routes.ts
|       `-- audit/
|           `-- audit.service.ts
`-- tests/
    |-- api.test.ts
    |-- audit.test.ts
    |-- config.test.ts
    |-- database.test.ts
    |-- redis.test.ts
    |-- security.test.ts
```

---

## 2. Foundational Database Models (Prisma)

Following Phase 3A's database contract (`docs/backend/DATABASE_SCHEMA.md`), the 7 foundational identity tables are defined in [schema.prisma](file:///K:/VYRON%20LAUNCHER/backend/prisma/schema.prisma):

1. **`User` (`users`)**:
   - `id`: UUID (Primary Key)
   - `email`: VarChar(255) Unique
   - `passwordHash`: Text
   - `role`: VarChar(32) (default: `USER`)
   - `status`: VarChar(32) (default: `PENDING_VERIFICATION`)
   - `failedLoginAttempts`: Int (default: 0)
   - `lockoutUntil`: Timestamp nullable
   - Timestamps: `createdAt`, `updatedAt`, `deletedAt`
2. **`UserSession` (`user_sessions`)**:
   - `id`: UUID (Primary Key)
   - `userId`: UUID (Foreign Key to `User.id` ON DELETE CASCADE)
   - `refreshTokenHash`: VarChar(64) Unique (never stored in plaintext)
   - `deviceId`: VarChar(128) nullable
   - `ipAddress`: VarChar(45) nullable
   - `userAgent`: Text nullable
   - `expiresAt`: Timestamp
   - `revokedAt`: Timestamp nullable
   - Timestamps: `createdAt`, `updatedAt`
3. **`OAuthAccount` (`oauth_accounts`)**:
   - Provider link records (for future identity linking; zero Microsoft tokens allowed)
4. **`Device` (`devices`)**:
   - Trusted device fingerprints, device names, client versions
5. **`EmailVerificationToken` (`email_verification_tokens`)**:
   - One-time verification tokens with SHA-256 token hashing and expiration
6. **`PasswordResetToken` (`password_reset_tokens`)**:
   - One-time password reset tokens with SHA-256 token hashing and expiration
7. **`AuditLog` (`audit_logs`)**:
   - Append-only security audit log with automatic secret redaction on JSON metadata

---

## 3. Security Boundaries & Architectural Invariants

### 3.1 Absolute Microsoft Credential Rule
The VYRON backend **never** stores, receives, or proxies Microsoft credentials:
- No Microsoft OAuth credentials
- No Microsoft access tokens or refresh tokens
- No Xbox Live (XBL) tokens
- No XSTS tokens
- No Minecraft access tokens
The Android client communicates directly with Microsoft/Mojang services locally.

### 3.2 Offline-First Invariant
Minecraft gameplay and launcher operations do not require backend connectivity:
- Local profile selection, offline worlds, installed mods, Java runtime selection, and Minecraft launches function normally when the backend is offline.
- Backend failures or network outages never impede the local Minecraft engine.

### 3.3 Argon2id Password Security
Configured per OWASP recommendations and Phase 3A specification:
- Memory Cost: 64 MB (`65536 KB`)
- Iterations (Time Cost): 3
- Parallelism: 2
- Salt: 16 cryptographically secure random bytes generated via `crypto.randomBytes(16)`
- Implemented with timing-safe comparisons via `crypto.timingSafeEqual`

### 3.4 Secret Redaction & Log Hardening
- Fastify logger configured with strict redaction paths:
  `req.headers.authorization`, `req.headers.cookie`, `*.password`, `*.passwordHash`, `*.token`, `*.accessToken`, `*.refreshToken`, `*.secret`
- Configuration module provides `getSanitizedConfig()`, redacting database URLs, secret keys, service role keys, and JWT secrets.
- Error handler intercepts internal database exceptions to prevent leaking raw SQL queries or connection strings to client responses.

---

## 4. API Foundation & Error Specification

### Endpoints Implemented
- `GET /health` & `GET /api/v1/health`: Lightweight process liveness probe returning `{ status: "ok", timestamp, uptime }`.
- `GET /ready` & `GET /api/v1/ready`: Deep readiness probe returning readiness checks for PostgreSQL and Redis:
  ```json
  {
    "status": "ready",
    "timestamp": "2026-10-22T07:26:35.643Z",
    "checks": {
      "database": "connected",
      "redis": "connected"
    }
  }
  ```

### Standardized Error Envelope
All errors adhere to the unified format:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Route GET:/api/v1/unknown not found",
    "statusCode": 404,
    "requestId": "req-1"
  }
}
```

---

## 5. Verification Matrix

| Verification Target | Result | Evidence |
|---|---|---|
| TypeScript Compilation | PASS | `npm run build` completed with code 0 |
| Vitest Test Suite | PASS | 16/16 tests passing across 6 suites |
| Supabase PostgreSQL | PASS | 7 tables synchronized via Prisma, `SELECT 1` ping and user queries passing |
| Redis Ephemeral State | PASS | Real/In-Memory abstraction passing set/get, delete, and TTL tests |
| Android PojavLauncher Engine | PASS | `:app_pojavlauncher:assembleDebug` completed with code 0 in 1m 45s |
| Secret Leakage Audit | PASS | Zero committed or tracked secrets across the repository |
