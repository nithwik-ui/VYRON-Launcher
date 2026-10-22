# Supabase Infrastructure & Database Configuration

## 1. Role of Supabase in VYRON

Supabase provides the managed PostgreSQL infrastructure for the VYRON backend.

**Critical Architectural Principle:**
Supabase is utilized as **managed PostgreSQL 17**. VYRON does **not** rely on Supabase Auth, Supabase Edge Functions, or direct client-to-Supabase connections for the Android client.

The Android client communicates exclusively through the VYRON Fastify API:
```
Android Client  --->  VYRON Fastify API  --->  Supabase PostgreSQL
```

This ensures complete backend portability: the database can be migrated to AWS RDS, Google Cloud SQL, or self-hosted PostgreSQL at any time without requiring changes to the Android client application or the authentication protocol.

---

## 2. Supabase Connection Architecture

### 2.1 Connection Endpoints
- **Project URL:** `https://<PROJECT_REF>.supabase.co`
- **PostgreSQL Host:** `db.<PROJECT_REF>.supabase.co:5432`
- **Database:** `postgres`

### 2.2 Connection Parameters
To ensure secure and reliable communication from backend services (including development environments routing through corporate firewalls or VPNs such as Cloudflare WARP):
- `sslmode=require`: Enforces SSL/TLS encryption for all database connections.
- `sslaccept=accept_invalid_certs`: Configured for environments with TLS interception proxies.
- `connect_timeout=20`: Extends connection timeout to 20 seconds to accommodate cold start handshakes.
- `pool_timeout=20`: Extends connection pool acquisition timeout.

---

## 3. Database Schema Synchronized (Phase 3C.1)

The following relational models have been deployed to the Supabase PostgreSQL database:

```sql
-- Foundational Tables Deployed in Phase 3C.1
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" VARCHAR(32) NOT NULL DEFAULT 'USER',
    "status" VARCHAR(32) NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "lockout_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" VARCHAR(64) NOT NULL,
    "device_id" VARCHAR(128),
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "oauth_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "provider_user_id" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_identifier" VARCHAR(128) NOT NULL,
    "device_name" VARCHAR(128),
    "client_version" VARCHAR(64),
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_verification_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(128) NOT NULL,
    "target_resource" VARCHAR(128) NOT NULL,
    "target_id" VARCHAR(128),
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "request_id" VARCHAR(64),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
```

---

## 4. Key Security Rules

1. **Server-Only Credentials:**
   The database connection string (`DATABASE_URL`), Supabase secret key (`SUPABASE_SECRET_KEY`), and service role key (`SUPABASE_SERVICE_ROLE_KEY`) are server-only. They are never packaged in the Android APK or exposed to public web clients.
2. **Hash-Only Token Storage:**
   Refresh tokens, email verification tokens, and password reset tokens are hashed with SHA-256 before storage in PostgreSQL. Raw tokens are never stored.
3. **No Microsoft Credentials:**
   Supabase PostgreSQL never holds Microsoft OAuth credentials, Minecraft access tokens, or Xbox Live session data.
4. **Prisma Connection Singleton:**
   PrismaClient connection pooling is managed via a resilient proxy pattern with automatic reconnect and health check retry logic.
