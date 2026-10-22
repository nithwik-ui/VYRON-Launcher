# VYRON Privacy, Telemetry & Data Retention Policy

**Document ID:** `docs/backend/PRIVACY_AND_RETENTION.md`  
**Phase:** Phase 3A.1  
**Scope:** Client data collection boundaries, backend telemetry ingestion, retention periods, and privacy safeguards.

---

## 1. Core Privacy Commitments

1. **Zero Secret Ingestion:** Under no circumstance does VYRON collect, transmit, or store Microsoft account passwords, OAuth access tokens, refresh tokens, Xbox Live credentials, or session cookies.
2. **Opt-In Telemetry:** Performance, crash, and usage analytics require explicit, informed user consent during initial setup or via Settings (`Settings -> Privacy -> Anonymous Analytics`).
3. **No PII in Telemetry:** Telemetry payloads are strictly pseudonymized or anonymized, stripped of player gamertags, email addresses, IP addresses, and unique hardware serials.

---

## 2. Data Classification Matrix

| Data Category | Specific Elements | Storage Location | Retention Period | Sharing Policy |
| :--- | :--- | :--- | :--- | :--- |
| **Minecraft Credentials** | MSA Refresh Token, Access Token, XSTS Token | On-Device KeyStore (`secure_vault/`) | Until account deleted locally | **NEVER SHARED / NEVER TRANSMITTED** |
| **VYRON Identity** | Email, Argon2id Password Hash, Display Name | Supabase PostgreSQL (`users`) | Until account deletion request | Internal only; strict access controls |
| **Device Metadata** | OS Version, App Version, Device Model, Architecture | PostgreSQL (`devices`) | 90 days of inactivity | Account security & session management |
| **Audit Logs** | Security events (login, password reset, MFA) | PostgreSQL (`audit_logs`) | 365 days (append-only) | Security forensics & regulatory audit |
| **Crash Reports** | Exception stack trace, renderer ID, Minecraft ver | Crash storage (sanitized) | 30 days | Anonymized; crash triage only |
| **Local Game Data** | Worlds, saves, resource packs, mods, screenshots | Local device storage (`.minecraft`) | Managed by user | **100% PRIVATE TO DEVICE** |

---

## 3. Telemetry Payload Sanitization Pipeline

Before any crash report or performance metric leaves the client:
1. Regex filter scrubs paths containing usernames (e.g. `/data/data/com.vyron.launcher/`).
2. Authentication headers (`Bearer ...`, `Authorization: ...`) are stripped.
3. Microsoft token patterns and UUIDs are masked.
4. Payload is compressed and transmitted over TLS 1.3 with pinned certificates.

---

## 4. User Rights & Deletion Procedures

In compliance with GDPR and Google Play Store User Data policies:
- **Account Deletion:** Users can trigger full account deletion via `/api/v1/auth/delete-account` or the VYRON web portal.
- **Data Purge:** Cascade deletion purges user profile, active sessions, devices, and tokens. Audit logs retain an anonymized SHA-256 hash of the actor ID for legal compliance.
