-- CreateTable
CREATE TABLE "launcher_releases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "version_name" VARCHAR(32) NOT NULL,
    "version_code" INTEGER NOT NULL,
    "channel" VARCHAR(32) NOT NULL DEFAULT 'STABLE',
    "min_android_sdk" INTEGER NOT NULL DEFAULT 21,
    "download_url" VARCHAR(512) NOT NULL,
    "sha256_hash" VARCHAR(64) NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "changelog_markdown" TEXT NOT NULL,
    "rollout_percentage" INTEGER NOT NULL DEFAULT 100,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "launcher_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crash_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "app_version" VARCHAR(32) NOT NULL,
    "android_sdk" INTEGER NOT NULL,
    "device_model" VARCHAR(128),
    "soc" VARCHAR(128),
    "minecraft_version" VARCHAR(64),
    "renderer" VARCHAR(64),
    "loader" VARCHAR(32),
    "stack_trace" TEXT NOT NULL,
    "error_reason" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crash_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(64) NOT NULL,
    "host" VARCHAR(255) NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 25565,
    "summary" TEXT NOT NULL,
    "description" TEXT,
    "icon_url" VARCHAR(512),
    "banner_url" VARCHAR(512),
    "website_url" VARCHAR(512),
    "category" VARCHAR(32) NOT NULL,
    "supported_versions" VARCHAR(64) NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_status" (
    "server_id" UUID NOT NULL,
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "players_online" INTEGER NOT NULL DEFAULT 0,
    "players_max" INTEGER NOT NULL DEFAULT 0,
    "motd_clean" TEXT,
    "ping_latency_ms" INTEGER,
    "last_pinged_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "server_status_pkey" PRIMARY KEY ("server_id")
);

-- CreateTable
CREATE TABLE "server_favorites" (
    "user_id" UUID NOT NULL,
    "server_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "server_favorites_pkey" PRIMARY KEY ("user_id","server_id")
);

-- CreateTable
CREATE TABLE "server_campaigns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "server_id" UUID NOT NULL,
    "campaign_name" VARCHAR(128) NOT NULL,
    "sponsor_name" VARCHAR(128) NOT NULL,
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "server_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_promotions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaign_id" UUID NOT NULL,
    "placement_slot" VARCHAR(32) NOT NULL,
    "impressions_count" BIGINT NOT NULL DEFAULT 0,
    "clicks_count" BIGINT NOT NULL DEFAULT 0,
    "badge_label" VARCHAR(32) NOT NULL DEFAULT 'SPONSORED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "server_promotions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_releases_channel_code" ON "launcher_releases"("channel", "version_code" DESC);
CREATE INDEX "idx_crashes_version_time" ON "crash_reports"("app_version", "created_at" DESC);
CREATE UNIQUE INDEX "uq_server_host_port" ON "servers"("host", "port");
CREATE INDEX "idx_servers_category" ON "servers"("category");
CREATE INDEX "idx_servers_active_verified" ON "servers"("is_active", "is_verified");
CREATE INDEX "idx_server_status_online" ON "server_status"("is_online", "players_online" DESC);
CREATE INDEX "idx_campaigns_active" ON "server_campaigns"("status", "start_at", "end_at");
CREATE INDEX "idx_promotions_slot" ON "server_promotions"("placement_slot");

-- AddForeignKey
ALTER TABLE "server_status" ADD CONSTRAINT "server_status_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "server_favorites" ADD CONSTRAINT "server_favorites_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "server_favorites" ADD CONSTRAINT "server_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "server_campaigns" ADD CONSTRAINT "server_campaigns_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "server_promotions" ADD CONSTRAINT "server_promotions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "server_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
