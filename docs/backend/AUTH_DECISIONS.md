# VYRON Architectural Decisions: Authentication & Identity Separation

**Document ID:** `docs/backend/AUTH_DECISIONS.md`  
**Phase:** Phase 3A.1  
**Decision Authority:** Core Architecture Board  
**Status:** APPROVED & BINDING  

---

## 1. Context & Problem Statement

Modern Minecraft Java Edition requires Microsoft OAuth 2.0 authentication, Xbox Live device authorization, XSTS token issuance, and Mojang ownership verification. Concurrently, the VYRON platform introduces cloud capabilities (news bookmarking, custom control cloud sharing, verified server listings, VYRON+ enhancements).

The primary architectural risk is the conflation of these two identity domains, which could lead to Microsoft credential exposure on third-party servers, violation of Mojang Terms of Service, or disruption of offline gameplay.

---

## 2. Key Architectural Decisions (ADR)

### ADR 1: Dual Independent Identity Domains
- **Decision:** Minecraft Account (MSA/Mojang) and VYRON Account are completely separate entities with zero credential sharing or proxying.
- **Rationale:** 
  - Protects user privacy.
  - Microsoft OAuth tokens are scoped exclusively to Microsoft/Mojang services and must never leave the client device.
  - A user may play Minecraft with an MSA account without ever creating a VYRON account.
  - A user may create a VYRON account for news and server directory features without linking an MSA account.

### ADR 2: On-Device Hardware-Backed KeyStore for Microsoft Tokens
- **Decision:** Microsoft OAuth access tokens, refresh tokens, and Minecraft user profiles are encrypted on-device using `AndroidKeyStore` with AES-256-GCM authenticated encryption.
- **Rationale:**
  - Prevents credential theft via file system inspection or rogue Android applications.
  - Cryptographic keys reside inside the device Secure Element / TEE (Trusted Execution Environment) or StrongBox.
  - Per-account Associated Authenticated Data (AAD) prevents cross-account token substitution.

### ADR 3: VYRON Backend Authentication Stack
- **Decision:** The VYRON backend utilizes standard email/password authentication with Argon2id password hashing, rotating short-lived JWT access tokens (15-minute expiry), and cryptographically random rolling refresh tokens (30-day expiry) stored as SHA-256 hashes in PostgreSQL and Redis.
- **Rationale:**
  - OWASP-recommended standard for modern identity backends.
  - Refresh token rotation and SHA-256 hashing protect against token reuse and database compromise.
  - Immediate multi-device session revocation via Redis blacklist.

### ADR 4: Absolute Prohibition on Piracy and Bypass Mechanics
- **Decision:** VYRON strictly disallows cracked authentication, offline account impersonation of Microsoft identities, token forgery, or Mojang ownership bypass.
- **Rationale:**
  - Compliance with Mojang Brand & Commercial Guidelines.
  - Essential requirement for Google Play Store approval.
  - Preserves Minecraft ecosystem integrity.

---

## 3. Summary of Decision Consequences

| Aspect | Impact on Client (`:app_pojavlauncher`) | Impact on Backend (`backend/`) |
| :--- | :--- | :--- |
| **Microsoft OAuth** | Maintained locally; encrypted in `secure_vault/` | Zero handling; rejected by API schemas |
| **Offline Play** | Always available; zero network dependency | N/A; backend outage cannot block launcher |
| **VYRON Login** | Optional; handled via `VyronAuthRepository` | Handled via `/api/v1/auth/*` |
| **Audit & Logging** | Redacts tokens in Logcat & crash logs | Redacts passwords & tokens in audit logs |
