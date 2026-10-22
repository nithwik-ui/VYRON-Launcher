# VYRON Security Model & Threat Mitigation Architecture
**Document ID:** `docs/backend/SECURITY_MODEL.md`  
**Phase:** Phase 3A (Backend Architecture & Service Contract Audit)  
**Status:** COMPLETED — SECURITY & PRIVACY SPECIFICATION  
**Scope:** Cryptography, Authentication Tokens, Data Protection, and Privacy Safeguards  

---

## 1. Absolute Security Invariants

The VYRON backend adheres to four non-negotiable security mandates:

1. **Zero Plaintext Passwords:** Passwords must NEVER be stored in plaintext. They are hashed using **Argon2id** with high memory cost and unique cryptographic salts.
2. **Total Microsoft Token Isolation:** Microsoft OAuth tokens and Mojang session keys generated on client devices MUST NEVER be transmitted to, stored on, or processed by the VYRON backend.
3. **Defense in Depth:** Every administrative action requires explicit RBAC permission verification, Multi-Factor Authentication (TOTP), and produces an append-only audit log entry.
4. **Data Minimization:** Telemetry, device profiling, and crash dumps must be completely stripped of Personally Identifiable Information (PII) before storage.

---

## 2. Token Architecture & Session Management

```text
[ Client Login ]
       │
       ▼
[ Backend Issues Two Tokens ]
       ├── 1. Access Token (JWT):
       │      - Lifetime: 15 minutes (short-lived)
       │      - Algorithm: Ed25519 (EdDSA) or RS256
       │      - Claims: user_id, username, role, device_id, jti
       │      - Delivered: Response JSON or Authorization Header
       │
       └── 2. Refresh Token (Opaque String):
              - Lifetime: 30 days (rolling)
              - Structure: 256-bit cryptographically secure random bytes
              - Storage: Stored in PostgreSQL as SHA-256 hash (`refresh_token_hash`)
              - Rotation: Every refresh request invalidates old token and issues a new one
```

### 2.1 Refresh Token Rotation & Replay Detection
- When `POST /api/v1/auth/refresh` is called:
  - If the presented refresh token exists and is valid: it is immediately marked as revoked and replaced with a newly generated token.
  - If a refresh token is presented that has **already been revoked**, the system detects a potential replay attack/theft, terminates ALL active sessions associated with that user session tree, and logs a security incident.

### 2.2 Device Session Tracking & Remote Invalidation
- Users can view all active devices connected to their account (`GET /api/v1/devices`).
- A user can revoke any individual session or click "Log Out of All Devices", which instantly blacklists all active JWTs in Redis and marks all refresh tokens as revoked in PostgreSQL.

---

## 3. Cryptography & Password Hashing

### 3.1 Password Hashing with Argon2id
- **Algorithm:** Argon2id (Winner of the Password Hashing Competition; resistant to GPU/ASIC attacks).
- **Parameters:**
  - Memory cost: 64 MB (`m=65536`)
  - Iterations: 3 passes (`t=3`)
  - Parallelism: 2 threads (`p=2`)
  - Salt: 128-bit cryptographically secure random bytes generated per user.

### 3.2 Encryption in Transit & at Rest
- **In Transit:** All external and internal communication enforced over **TLS 1.3** (minimum TLS 1.2). Strict-Transport-Security (HSTS) with `max-age=63072000; includeSubDomains; preload`.
- **At Rest:**
  - PostgreSQL database volumes encrypted via AES-256 (AWS EBS / Managed Disk Encryption).
  - Sensitive third-party secrets and OAuth refresh tokens encrypted in the database using envelope encryption (AES-256-GCM) with keys managed in AWS KMS / HashiCorp Vault.

---

## 4. API Abuse Prevention & Rate Limiting

To protect against credential stuffing, brute force, and DDoS attacks, rate limiting is applied across multiple tiers using Redis sliding-window counters:

| Target Endpoint | Rate Limit Window | Max Requests | Violation Action |
|---|:---:|:---:|---|
| **`/api/v1/auth/login`** | 15 minutes | 5 attempts per IP / Account | HTTP 429 Too Many Requests + 15 min lock |
| **`/api/v1/auth/register`** | 1 hour | 3 accounts per IP | HTTP 429 + CAPTCHA challenge |
| **`/api/v1/auth/refresh`** | 1 minute | 10 requests per device | HTTP 429 |
| **`/api/v1/telemetry/*`** | 1 minute | 30 events per device | Silent discard (HTTP 202 Accepted) |
| **Standard Public Reads** | 1 minute | 120 requests per IP | HTTP 429 with `Retry-After` header |

---

## 5. Web & Admin Security (CORS, CSRF, Secure Cookies)

1. **CORS (Cross-Origin Resource Sharing):**
   - Public API routes allow mobile app clients and explicitly whitelisted domains (`vyronlauncher.com`, `admin.vyronlauncher.com`).
   - Wildcard `Access-Control-Allow-Origin: *` is strictly prohibited on all authenticated routes.
2. **Secure Cookies for Admin Web Panel:**
   - Admin session tokens are stored in `HttpOnly`, `Secure`, `SameSite=Strict` cookies to prevent Cross-Site Scripting (XSS) extraction.
3. **CSRF Protection:**
   - Double-Submit Cookie pattern or custom request header verification (`X-Requested-With`) applied to all state-changing admin browser requests.
4. **Content Security Policy (CSP):**
   - Admin panel enforces strict CSP preventing inline scripts and unauthorized external font/script inclusions.

---

## 6. Privacy & Data Minimization (GDPR / COPPA Compliance)

Given that Minecraft has a diverse player base including younger audiences, VYRON enforces strict privacy standards:

1. **No Real-Name or Geolocation Tracking:**  
   The backend does not request, collect, or store real user names, phone numbers, or GPS coordinates.
2. **IP Address Pseudonymization:**  
   Client IP addresses captured for rate-limiting and security are hashed or truncated after 7 days.
3. **Right to Erasure (Account Deletion):**  
   Users can request immediate account deletion via `DELETE /api/v1/profile`. Upon confirmation:
   - Account record, linked Minecraft UUIDs, and preferences are hard-deleted.
   - Sessions and device records are purged from PostgreSQL and Redis.
   - Anonymized telemetry remains decoupled without any user identifier.
