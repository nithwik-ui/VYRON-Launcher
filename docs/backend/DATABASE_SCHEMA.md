# VYRON Database Schema & Entity Design
**Document ID:** `docs/backend/DATABASE_SCHEMA.md`  
**Phase:** Phase 3A (Backend Architecture & Service Contract Audit)  
**Status:** COMPLETED — ARCHITECTURAL DATABASE SPECIFICATION  
**Target RDBMS:** PostgreSQL 16+ (Standard SQL DDL Specification)  

---

## 1. Architectural Guardrails & Database Scope

> [!IMPORTANT]
> **No Game Data Storage**:  
> The VYRON backend database does NOT store Minecraft worlds, mods, resource packs, shader packs, local instance files, client assets, or Java runtime binaries. The local launcher filesystem is authoritative for all game runtime files.

### 1.1 Phase Classification Key
- **[Phase 1 Baseline]:** Core identity, device sessions, news, server directory, and basic releases.
- **[Phase 2 Core]:** Server promotions, compatibility matrix, remote config, and admin RBAC.
- **[Future Horizon]:** Cloud backup vaults, subscriptions, payments, support tickets, and large-scale analytics.

---

## 2. Identity & Access Domain

### 2.1 Table: `users` [Phase 1 Baseline]
Primary entity representing a registered VYRON account.
```sql
CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username            VARCHAR(32) NOT NULL UNIQUE,
    email               VARCHAR(255) NOT NULL UNIQUE,
    password_hash       VARCHAR(255) NOT NULL, -- Argon2id hash
    avatar_url          VARCHAR(512),
    bio                 TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
```

### 2.2 Table: `user_sessions` [Phase 1 Baseline]
Tracks active login sessions, refresh tokens, and authentication origin.
```sql
CREATE TABLE user_sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id           VARCHAR(128) NOT NULL,
    refresh_token_hash  VARCHAR(255) NOT NULL UNIQUE,
    ip_address          INET,
    user_agent          TEXT,
    expires_at          TIMESTAMPTZ NOT NULL,
    revoked_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_refresh_token ON user_sessions(refresh_token_hash);
CREATE INDEX idx_user_sessions_device_id ON user_sessions(device_id);
```

### 2.3 Table: `oauth_accounts` [Phase 1 Baseline]
Third-party OAuth providers linked to a VYRON account (e.g. Discord, Google).  
*(Note: Minecraft Microsoft tokens remain strictly local on the Android device; this table is for VYRON account login).*
```sql
CREATE TABLE oauth_accounts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider            VARCHAR(32) NOT NULL, -- 'discord', 'google'
    provider_user_id    VARCHAR(255) NOT NULL,
    access_token_enc    TEXT, -- Encrypted at rest
    refresh_token_enc   TEXT,
    profile_data        JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_oauth_provider_user UNIQUE(provider, provider_user_id)
);

CREATE INDEX idx_oauth_accounts_user ON oauth_accounts(user_id);
```

### 2.4 Table: `devices` [Phase 1 Baseline]
Tracks distinct Android client hardware signatures for notification push and remote security.
```sql
CREATE TABLE devices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
    device_fingerprint  VARCHAR(128) NOT NULL UNIQUE,
    device_model        VARCHAR(128),
    manufacturer        VARCHAR(64),
    android_version     INT,
    app_version         VARCHAR(32) NOT NULL,
    fcm_push_token      TEXT,
    last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_devices_fingerprint ON devices(device_fingerprint);
CREATE INDEX idx_devices_user_id ON devices(user_id);
```

---

## 3. Minecraft & Runtime Domain

### 3.1 Table: `minecraft_accounts` [Phase 2 Core]
Stores public player identity linkages associated with a VYRON cloud profile (UUID & Gamertag only).
```sql
CREATE TABLE minecraft_accounts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    minecraft_uuid      UUID NOT NULL, -- Hyphenated Minecraft UUID
    minecraft_username  VARCHAR(32) NOT NULL,
    skin_texture_url    VARCHAR(512),
    is_primary          BOOLEAN NOT NULL DEFAULT FALSE,
    linked_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_minecraft_account UNIQUE(user_id, minecraft_uuid)
);

CREATE INDEX idx_minecraft_accounts_user ON minecraft_accounts(user_id);
CREATE INDEX idx_minecraft_accounts_uuid ON minecraft_accounts(minecraft_uuid);
```

### 3.2 Table: `minecraft_versions` [Phase 1 Baseline]
Catalog of indexed official Minecraft Java versions.
```sql
CREATE TABLE minecraft_versions (
    id                  VARCHAR(64) PRIMARY KEY, -- e.g. '1.21.4', '24w40a'
    version_type        VARCHAR(32) NOT NULL,    -- 'release', 'snapshot', 'old_beta', 'old_alpha'
    release_time        TIMESTAMPTZ NOT NULL,
    piston_url          VARCHAR(512) NOT NULL,   -- Mojang JSON manifest URL
    sha1_hash           VARCHAR(64) NOT NULL,
    compliance_level    INT NOT NULL DEFAULT 0,
    is_published        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_minecraft_versions_type ON minecraft_versions(version_type, release_time DESC);
```

### 3.3 Table: `minecraft_version_metadata` [Phase 1 Baseline]
Normalized technical requirements parsed from version manifests.
```sql
CREATE TABLE minecraft_version_metadata (
    version_id          VARCHAR(64) PRIMARY KEY REFERENCES minecraft_versions(id) ON DELETE CASCADE,
    min_java_version    INT NOT NULL DEFAULT 8,
    main_class          VARCHAR(255) NOT NULL,
    asset_index_id      VARCHAR(64) NOT NULL,
    required_libraries  JSONB NOT NULL DEFAULT '[]',
    raw_manifest_json   JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.4 Table: `java_runtimes` [Phase 1 Baseline]
Repository of certified OpenJDK build packages available for download.
```sql
CREATE TABLE java_runtimes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    major_version       INT NOT NULL,            -- 8, 17, 21, 25
    architecture        VARCHAR(32) NOT NULL,    -- 'arm64-v8a', 'armeabi-v7a', 'x86_64', 'x86'
    vendor              VARCHAR(64) NOT NULL,    -- 'AngelAuraMC-OpenJDK', 'Adoptium'
    download_url        VARCHAR(512) NOT NULL,
    sha256_checksum     VARCHAR(64) NOT NULL,
    file_size_bytes     BIGINT NOT NULL,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_java_runtime_arch UNIQUE(major_version, architecture, vendor)
);

CREATE INDEX idx_java_runtimes_version_arch ON java_runtimes(major_version, architecture);
```

### 3.5 Table: `compatibility_profiles` [Phase 2 Core]
Community- and team-tested hardware compatibility ratings.
```sql
CREATE TABLE compatibility_profiles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    minecraft_version   VARCHAR(64) NOT NULL REFERENCES minecraft_versions(id) ON DELETE CASCADE,
    device_soc          VARCHAR(128) NOT NULL,   -- e.g. 'Snapdragon 8 Gen 2', 'Dimensity 9200'
    gpu_renderer        VARCHAR(64) NOT NULL,    -- 'ANGLE', 'Zink', 'MobileGlues', 'SFPEW'
    recommended_java    INT NOT NULL,
    loader              VARCHAR(32) NOT NULL DEFAULT 'Vanilla', -- 'Vanilla', 'Fabric', 'NeoForge'
    status              VARCHAR(32) NOT NULL,    -- 'SUPPORTED', 'EXPERIMENTAL', 'UNKNOWN', 'BLOCKED'
    recommended_ram_mb  INT NOT NULL,
    notes               TEXT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_compat_lookup ON compatibility_profiles(minecraft_version, device_soc, gpu_renderer);
```

---

## 4. Server Directory & Promotions Domain

### 4.1 Table: `servers` [Phase 1 Baseline]
Public directory of Minecraft Java multiplayer servers.
```sql
CREATE TABLE servers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(64) NOT NULL,
    host                VARCHAR(255) NOT NULL,
    port                INT NOT NULL DEFAULT 25565,
    summary             TEXT NOT NULL,
    description         TEXT,
    icon_url            VARCHAR(512),
    banner_url          VARCHAR(512),
    website_url         VARCHAR(512),
    category            VARCHAR(32) NOT NULL,    -- 'Survival', 'Minigames', 'RPG', 'Anarchy', 'Skyblock'
    supported_versions  VARCHAR(64) NOT NULL,    -- e.g. '1.8 - 1.21.x'
    is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_server_host_port UNIQUE(host, port)
);

CREATE INDEX idx_servers_category ON servers(category);
CREATE INDEX idx_servers_active_verified ON servers(is_active, is_verified);
```

### 4.2 Table: `server_status` [Phase 1 Baseline]
Real-time cached status and player count pings.
```sql
CREATE TABLE server_status (
    server_id           UUID PRIMARY KEY REFERENCES servers(id) ON DELETE CASCADE,
    is_online           BOOLEAN NOT NULL DEFAULT FALSE,
    players_online      INT NOT NULL DEFAULT 0,
    players_max         INT NOT NULL DEFAULT 0,
    motd_clean          TEXT,
    ping_latency_ms     INT,
    last_pinged_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_server_status_online ON server_status(is_online, players_online DESC);
```

### 4.3 Table: `server_favorites` [Phase 1 Baseline]
User-bookmarked favorite servers synchronized across devices.
```sql
CREATE TABLE server_favorites (
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    server_id           UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(user_id, server_id)
);
```

### 4.4 Table: `server_campaigns` [Phase 2 Core]
Commercial promotion campaigns for featured placements.
```sql
CREATE TABLE server_campaigns (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id           UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    campaign_name       VARCHAR(128) NOT NULL,
    sponsor_name        VARCHAR(128) NOT NULL,
    start_at            TIMESTAMPTZ NOT NULL,
    end_at              TIMESTAMPTZ NOT NULL,
    priority            INT NOT NULL DEFAULT 0,  -- Higher priority gets top placement
    status              VARCHAR(32) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'PAUSED', 'EXPIRED'
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaigns_active ON server_campaigns(status, start_at, end_at);
```

### 4.5 Table: `server_promotions` [Phase 2 Core]
Granular placement and impression tracking for campaigns.
```sql
CREATE TABLE server_promotions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         UUID NOT NULL REFERENCES server_campaigns(id) ON DELETE CASCADE,
    placement_slot      VARCHAR(32) NOT NULL,    -- 'HOME_HERO', 'SERVERS_FEATURED', 'SERVERS_BANNER'
    impressions_count   BIGINT NOT NULL DEFAULT 0,
    clicks_count        BIGINT NOT NULL DEFAULT 0,
    badge_label         VARCHAR(32) NOT NULL DEFAULT 'SPONSORED', -- 'SPONSORED', 'FEATURED', 'PARTNER'
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_promotions_slot ON server_promotions(placement_slot);
```

---

## 5. Content Management (News & Announcements)

### 5.1 Table: `news_categories` [Phase 1 Baseline]
```sql
CREATE TABLE news_categories (
    id                  VARCHAR(32) PRIMARY KEY, -- 'updates', 'community', 'guides', 'events'
    name                VARCHAR(64) NOT NULL,
    description         TEXT,
    display_order       INT NOT NULL DEFAULT 0
);
```

### 5.2 Table: `news_articles` [Phase 1 Baseline]
Rich articles delivered to Android home feed and news reader.
```sql
CREATE TABLE news_articles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                VARCHAR(128) NOT NULL UNIQUE,
    title               VARCHAR(255) NOT NULL,
    summary             TEXT NOT NULL,
    body_markdown       TEXT NOT NULL,
    cover_image_url     VARCHAR(512),
    category_id         VARCHAR(32) NOT NULL REFERENCES news_categories(id),
    author_name         VARCHAR(64) NOT NULL,
    status              VARCHAR(32) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'
    is_featured         BOOLEAN NOT NULL DEFAULT FALSE,
    published_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_news_published ON news_articles(status, published_at DESC);
CREATE INDEX idx_news_featured ON news_articles(is_featured, published_at DESC);
```

### 5.3 Table: `announcements` [Phase 1 Baseline]
Urgent in-app notification banners and service notices.
```sql
CREATE TABLE announcements (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title               VARCHAR(128) NOT NULL,
    message             TEXT NOT NULL,
    severity            VARCHAR(32) NOT NULL DEFAULT 'INFO', -- 'INFO', 'WARNING', 'CRITICAL', 'MAINTENANCE'
    action_url          VARCHAR(512),
    start_at            TIMESTAMPTZ NOT NULL,
    end_at              TIMESTAMPTZ NOT NULL,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_announcements_active ON announcements(is_active, start_at, end_at);
```

---

## 6. Releases & Rollouts Domain

### 6.1 Table: `launcher_releases` [Phase 1 Baseline]
Published APK releases for the VYRON Android client.
```sql
CREATE TABLE launcher_releases (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_name        VARCHAR(32) NOT NULL UNIQUE, -- e.g. '3.1.0'
    version_code        INT NOT NULL UNIQUE,         -- e.g. 30100
    release_channel     VARCHAR(32) NOT NULL,        -- 'STABLE', 'BETA', 'NIGHTLY'
    apk_download_url    VARCHAR(512) NOT NULL,
    apk_sha256          VARCHAR(64) NOT NULL,
    file_size_bytes     BIGINT NOT NULL,
    changelog_markdown  TEXT NOT NULL,
    min_android_sdk     INT NOT NULL DEFAULT 21,
    is_mandatory        BOOLEAN NOT NULL DEFAULT FALSE,
    published_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_releases_channel ON launcher_releases(release_channel, version_code DESC);
```

### 6.2 Table: `rollout_rules` [Phase 2 Core]
Staged percentage rollouts and device gating.
```sql
CREATE TABLE rollout_rules (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    release_id          UUID NOT NULL REFERENCES launcher_releases(id) ON DELETE CASCADE,
    rollout_percentage  INT NOT NULL DEFAULT 10,     -- 0 to 100
    min_ram_mb          INT,
    target_countries    VARCHAR(2)[],
    is_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 7. Administration & RBAC Domain

### 7.1 Tables: `admin_users`, `roles`, `permissions`, `role_permissions` [Phase 2 Core]
```sql
CREATE TABLE roles (
    id                  VARCHAR(32) PRIMARY KEY, -- 'SUPER_ADMIN', 'CONTENT_ADMIN', 'SERVER_ADMIN', 'RELEASE_ADMIN', 'MODERATOR', 'SUPPORT_ADMIN', 'ANALYTICS'
    name                VARCHAR(64) NOT NULL,
    description         TEXT
);

CREATE TABLE permissions (
    id                  VARCHAR(64) PRIMARY KEY, -- e.g. 'news:publish', 'servers:verify', 'releases:deploy'
    module              VARCHAR(32) NOT NULL,
    description         TEXT
);

CREATE TABLE role_permissions (
    role_id             VARCHAR(32) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id       VARCHAR(64) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY(role_id, permission_id)
);

CREATE TABLE admin_users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    role_id             VARCHAR(32) NOT NULL REFERENCES roles(id),
    mfa_secret          VARCHAR(64), -- TOTP secret (encrypted)
    is_mfa_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 7.2 Table: `admin_audit_logs` [Phase 2 Core]
Immutable log recording every administrative modification.
```sql
CREATE TABLE admin_audit_logs (
    id                  BIGSERIAL PRIMARY KEY,
    admin_user_id       UUID NOT NULL REFERENCES users(id),
    action              VARCHAR(64) NOT NULL,        -- 'SERVER_VERIFIED', 'RELEASE_PUBLISHED'
    target_entity       VARCHAR(64) NOT NULL,        -- 'servers', 'launcher_releases'
    target_id           VARCHAR(128) NOT NULL,
    before_state        JSONB,
    after_state         JSONB,
    ip_address          INET,
    user_agent          TEXT,
    timestamp           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_timestamp ON admin_audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_target ON admin_audit_logs(target_entity, target_id);
```

---

## 8. Future Horizon Domain [Future]

```sql
-- Cloud Backup Manifests
CREATE TABLE cloud_backups (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    backup_type         VARCHAR(32) NOT NULL, -- 'CONTROLS', 'PROFILE', 'WORLD'
    file_size_bytes     BIGINT NOT NULL,
    storage_blob_path   VARCHAR(512) NOT NULL,
    encryption_salt     VARCHAR(64) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subscriptions & Payments
CREATE TABLE subscriptions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_tier           VARCHAR(32) NOT NULL, -- 'VYRON_PLUS_MONTHLY', 'VYRON_PLUS_ANNUAL'
    status              VARCHAR(32) NOT NULL, -- 'ACTIVE', 'PAST_DUE', 'CANCELED'
    current_period_end  TIMESTAMPTZ NOT NULL
);

CREATE TABLE payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),
    provider            VARCHAR(32) NOT NULL, -- 'GOOGLE_PLAY', 'STRIPE'
    provider_tx_id      VARCHAR(255) NOT NULL UNIQUE,
    amount_cents        INT NOT NULL,
    currency            VARCHAR(3) NOT NULL DEFAULT 'USD',
    status              VARCHAR(32) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Support Tickets
CREATE TABLE support_tickets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),
    subject             VARCHAR(255) NOT NULL,
    status              VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    priority            VARCHAR(32) NOT NULL DEFAULT 'NORMAL',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Aggregated Analytics Events
CREATE TABLE analytics_events (
    id                  BIGSERIAL PRIMARY KEY,
    event_name          VARCHAR(64) NOT NULL,
    device_fingerprint  VARCHAR(128),
    properties          JSONB NOT NULL,
    occurred_at         TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_analytics_event_name ON analytics_events(event_name, occurred_at DESC);
```
