# VYRON Backend Architecture & Systems Design
**Document ID:** `docs/backend/BACKEND_ARCHITECTURE.md`  
**Phase:** Phase 3A (Backend Architecture & Service Contract Audit)  
**Status:** COMPLETED — SYSTEM ARCHITECTURE SPECIFICATION  
**Target Topology:** Modular Monolith on Fastify / Node.js / PostgreSQL / Redis  

---

## 1. Architectural Strategy: Pragmatic Modular Monolith

For VYRON's backend, the recommended architecture is a **high-throughput, domain-partitioned Modular Monolith** built on **TypeScript, Node.js, Fastify, PostgreSQL, and Redis**, fronted by **Cloudflare Edge CDN** and S3-compatible object storage.

### 1.1 Why a Modular Monolith Instead of Microservices?
1. **Operational Simplicity & Cost:** As an emerging product, running a Kubernetes cluster with 8 distributed microservices would introduce excessive operational overhead (service meshes, distributed tracing, network latency, multi-repo CI/CD, complex local testing).
2. **Transactional Integrity:** Operations like user registration, campaign billing, and admin auditing benefit from single-database ACID transactions.
3. **Seamless Evolution Path:** By enforcing strict internal module boundaries (clean architecture, decoupled domain services, zero cross-module direct table access), any module (e.g. Telemetry or Server Pinger) can be split into an independent microservice later with minimal refactoring.

---

## 2. Technology Stack Evaluation & Comparison

We evaluated multiple industry-standard backend stacks against VYRON's specific requirements (high read throughput, async I/O, rapid schema evolution, team velocity, and robust type sharing with future admin panels):

| Evaluation Criteria | **TypeScript + Fastify (Selected)** | **Go (Golang + Gin/Fiber)** | **Python (FastAPI + SQLAlchemy)** | **Java / Kotlin (Spring Boot)** | **Rust (Axum + Tokio)** |
|---|---|---|---|---|---|
| **I/O Throughput & Concurrency** | **Very High** (V8 event loop + Fastify schema compilation) | Extremely High (goroutines) | Moderate (asyncio overhead) | High (Virtual Threads / Loom) | Maximum (zero-cost abstractions) |
| **Development Velocity** | **Rapid** (TypeScript, Prisma/Kysely, rich npm ecosystem) | High (strict simplicity) | Rapid (batteries included) | Moderate (verbose boilerplate) | Low (borrow checker, compile times) |
| **Type Safety & Code Sharing** | **End-to-End** (Types shared directly with Next.js Admin) | Backend only | Backend only (Pydantic) | Backend only | Backend only |
| **Memory Footprint** | **Low-Medium** (~80-150MB baseline) | Very Low (~20-40MB) | Medium (~100-200MB) | High (~300-600MB JVM heap) | Ultra-Low (~15-30MB) |
| **Database Migrations & Tooling** | **Exceptional** (Kysely / Prisma / Drizzle) | Good (golang-migrate) | Excellent (Alembic) | Robust (Flyway / Liquibase) | Moderate (sqlx / refinery) |
| **Suitability for VYRON** | **Optimal** | Strong alternative | Sub-optimal for scale | Overkill & slow boot | Too low developer velocity |

### Justification for Selected Stack:
- **Fastify over Express:** Fastify provides built-in JSON Schema compilation (via `fast-json-stringify`), high-performance HTTP routing (radix tree), and native lifecycle hooks, achieving up to 4-5x the throughput of Express.
- **PostgreSQL 16+:** Unmatched reliability, native JSONB support for version metadata and Minecraft manifests, robust indexing (GIN/GiST), and rock-solid relational consistency.
- **Redis 7+:** In-memory caching for server status pings, token revocation blacklists, rate-limiting windows, and pub/sub for push notifications.
- **S3-Compatible Storage (Cloudflare R2 / AWS S3):** Asset storage for news cover images, community skin textures, APK binaries, and future world backups, eliminating egress bandwidth fees when paired with Cloudflare.

---

## 3. High-Level Architecture Topology

```text
                                [ CLIENT SURFACE ]
                                        │
                         Android Launcher App (VYRON)
                                        │
                                        ▼ HTTPS / REST
                                 [ EDGE TIER ]
                     Cloudflare CDN + DDoS + Edge Caching
                                        │
                                        ▼ (Authenticated Edge Route)
                                 [ API GATEWAY ]
                     Reverse Proxy (Nginx / Caddy / Cloudflare)
                                        │
      ┌─────────────────────────────────┴─────────────────────────────────┐
      │                      VYRON MODULAR MONOLITH                       │
      │                                                                   │
      │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
      │  │  Auth & User │  │ News & CMS   │  │ Server Dir & │             │
      │  │  Identity    │  │ Module       │  │ Promotions   │             │
      │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
      │         │                 │                 │                     │
      │  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐             │
      │  │  Minecraft   │  │ Device & OS  │  │ Performance  │             │
      │  │  Versions    │  │ Compatibility│  │ Telemetry    │             │
      │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
      │         │                 │                 │                     │
      │  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐             │
      │  │  Releases &  │  │ Remote Conf  │  │ Admin RBAC & │             │
      │  │  Rollouts    │  │ & Flags      │  │ Audit Logs   │             │
      │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
      └─────────┼─────────────────┼─────────────────┼─────────────────────┘
                │                 │                 │
                ▼                 ▼                 ▼
        [ DATA TIER ]     [ CACHE TIER ]    [ OBJECT STORAGE ]
          PostgreSQL          Redis             Cloudflare R2 /
             16+                7+                  AWS S3
```

---

## 4. Internal Modular Monolith Design

The backend codebase will be structured around **Domain-Driven Design (DDD)** principles within a single monolithic repository:

```text
src/
├── app.ts                        # Fastify instance initialization
├── server.ts                     # Process bootstrap & graceful shutdown
├── config/                       # Strongly typed env configuration (Zod)
├── common/                       # Shared utilities, errors, middleware
│   ├── errors/                   # AppError, DomainError, ValidationError
│   ├── middleware/               # Auth guard, rate limiter, request ID
│   └── telemetry/                # OpenTelemetry / Pino logger
└── modules/                      # Autonomous Domain Modules
    ├── auth/                     # Identity, JWT, Sessions, Passwords
    ├── user/                     # User Profiles, Settings Sync
    ├── news/                     # News CMS, Announcements, Slugs
    ├── servers/                  # Directory, Status Pinger, Favorites
    ├── promotions/               # Campaigns, Sponsored Bids, Placements
    ├── minecraft/                # Piston Ingestion, Version Manifests
    ├── compatibility/            # Device/GPU Compatibility Matrix
    ├── releases/                 # APK Versioning, Staged Rollouts
    ├── telemetry/                # Anonymized Launch & Crash Ingestion
    └── admin/                    # RBAC, Staff Roles, Audit Trails
```

### 4.1 Module Independence Rules
1. **Isolated Data Access:** Each module owns its repository and database tables. Direct queries to another module's internal tables are strictly prohibited.
2. **In-Memory Service Interfaces:** Inter-module communication occurs via strongly typed TypeScript service contracts (e.g., `UserService.getPublicProfileById()`), not through internal HTTP calls.
3. **Event-Driven Decoupling:** Cross-cutting side effects (e.g. `UserRegisteredEvent` triggering a welcome notification) are dispatched using an internal lightweight event bus (e.g., `EventEmitter2` or Redis Pub/Sub).

---

## 5. Deployment Topology & Future Scalability

### 5.1 Initial Phase 3 Deployment Topology
- **API Server:** 2x load-balanced Node.js Fastify containers (Docker / ECS / Railway / VPS).
- **Database:** Managed PostgreSQL (16+) with automated daily backups and connection pooling (PgBouncer).
- **Cache:** Managed Redis cluster node with eviction policy `volatile-lru`.
- **Static Assets & Media:** Cloudflare R2 bucket mapped behind `assets.vyronlauncher.com`.
- **Admin Application:** Standalone Next.js (SSR) application deployed on Vercel/Node.js, consuming `/api/v1/admin/` endpoints.

### 5.2 Decoupling Triggers (When to split into microservices)
If specific components exhibit asymmetric scaling characteristics:
1. **Server Pinger Service:** If polling thousands of Minecraft servers for MOTD/player counts burdens the API, extract it into a dedicated Go/Node worker consuming a Redis task queue.
2. **Telemetry Ingestion Service:** If millions of daily client heartbeats/crashes require high ingestion bandwidth, extract `/api/v1/telemetry` into a lightweight Go/Rust ingestion daemon piping directly to ClickHouse or TimescaleDB.
