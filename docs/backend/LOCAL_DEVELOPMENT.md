# VYRON Backend — Local Development Guide

## Prerequisites

- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher
- **PostgreSQL**: PostgreSQL 15+ (or cloud-hosted Supabase instance)
- **Redis**: Redis 6.2+ (optional for local development; in-memory fallback is automatically engaged if Redis daemon is offline)

---

## 1. Quick Start

### 1.1 Clone and Navigate
```bash
cd backend
```

### 1.2 Install Dependencies
```bash
npm install
```

### 1.3 Configure Environment Variables
Copy the template configuration file:
```bash
cp .env.example .env
```
Populate `.env` with your actual development database credentials and secrets:
```env
APP_ENV=development
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info

# PostgreSQL Connection String (Supabase or Local)
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?sslmode=require&connect_timeout=20&pool_timeout=20"
DIRECT_URL="postgresql://postgres:YOUR_PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?sslmode=require&connect_timeout=20&pool_timeout=20"

# Supabase Keys (Server-only)
SUPABASE_URL="https://PROJECT_REF.supabase.co"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
SUPABASE_SECRET_KEY="sb_secret_..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."
JWT_SECRET="YOUR_SECURE_JWT_SECRET_AT_LEAST_16_CHARS"

# Redis
REDIS_URL="redis://localhost:6379"

# Security & Limits
CORS_ORIGIN="http://localhost:3000,http://localhost:5173"
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000
```

> [!CAUTION]
> Never commit `.env` to Git. The repository's root and backend `.gitignore` strictly ignore `.env` and `.env.*`.

---

## 2. Database Synchronization & Migrations

### 2.1 Push Schema to Database
To synchronize the Prisma schema directly to your development or Supabase database:
```bash
npx prisma db push
```

### 2.2 Generate Prisma Client
```bash
npx prisma generate
```

### 2.3 Inspect Database via Prisma Studio
```bash
npx prisma studio
```

---

## 3. Running the Server

### 3.1 Development Mode (Watch Mode)
```bash
npm run dev
```

### 3.2 Production Build & Run
```bash
npm run build
npm start
```

---

## 4. Operational Probes Verification

Once running, verify the service probes:

### 4.1 Liveness Probe
```bash
curl http://localhost:3000/health
```
Response:
```json
{
  "status": "ok",
  "timestamp": "2026-10-22T07:26:35.000Z",
  "uptime": 12.34
}
```

### 4.2 Readiness Probe
```bash
curl http://localhost:3000/api/v1/ready
```
Response:
```json
{
  "status": "ready",
  "timestamp": "2026-10-22T07:26:35.500Z",
  "checks": {
    "database": "connected",
    "redis": "connected"
  }
}
```

---

## 5. Running Automated Tests

Run the complete test suite:
```bash
npm test
```

Run a specific test suite:
```bash
npx vitest run tests/database.test.ts
npx vitest run tests/security.test.ts
npx vitest run tests/api.test.ts
npx vitest run tests/redis.test.ts
npx vitest run tests/audit.test.ts
npx vitest run tests/config.test.ts
```
