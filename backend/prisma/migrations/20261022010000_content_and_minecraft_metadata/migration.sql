-- CreateTable
CREATE TABLE "news_categories" (
    "id" VARCHAR(32) NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "description" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "news_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_articles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(128) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "summary" TEXT NOT NULL,
    "body_markdown" TEXT NOT NULL,
    "cover_image_url" VARCHAR(512),
    "category_id" VARCHAR(32) NOT NULL,
    "author_name" VARCHAR(64) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(128) NOT NULL,
    "message" TEXT NOT NULL,
    "severity" VARCHAR(32) NOT NULL DEFAULT 'INFO',
    "action_url" VARCHAR(512),
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "minecraft_versions" (
    "id" VARCHAR(64) NOT NULL,
    "version_type" VARCHAR(32) NOT NULL,
    "release_time" TIMESTAMPTZ(6) NOT NULL,
    "piston_url" VARCHAR(512) NOT NULL,
    "sha1_hash" VARCHAR(64) NOT NULL,
    "compliance_level" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "minecraft_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "minecraft_version_metadata" (
    "version_id" VARCHAR(64) NOT NULL,
    "min_java_version" INTEGER NOT NULL DEFAULT 8,
    "main_class" VARCHAR(255) NOT NULL,
    "asset_index_id" VARCHAR(64) NOT NULL,
    "required_libraries" JSONB NOT NULL DEFAULT '[]',
    "raw_manifest_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "minecraft_version_metadata_pkey" PRIMARY KEY ("version_id")
);

-- CreateTable
CREATE TABLE "compatibility_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "minecraft_version" VARCHAR(64) NOT NULL,
    "device_soc" VARCHAR(128) NOT NULL,
    "gpu_renderer" VARCHAR(64) NOT NULL,
    "recommended_java" INTEGER NOT NULL,
    "loader" VARCHAR(32) NOT NULL DEFAULT 'Vanilla',
    "status" VARCHAR(32) NOT NULL,
    "recommended_ram_mb" INTEGER NOT NULL,
    "notes" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compatibility_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "java_runtimes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "major_version" INTEGER NOT NULL,
    "architecture" VARCHAR(32) NOT NULL,
    "vendor" VARCHAR(64) NOT NULL,
    "download_url" VARCHAR(512) NOT NULL,
    "sha256_checksum" VARCHAR(64) NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "java_runtimes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "news_articles_slug_key" ON "news_articles"("slug");
CREATE INDEX "idx_news_published" ON "news_articles"("status", "published_at" DESC);
CREATE INDEX "idx_news_featured" ON "news_articles"("is_featured", "published_at" DESC);

-- CreateIndex
CREATE INDEX "idx_announcements_active" ON "announcements"("is_active", "start_at", "end_at");

-- CreateIndex
CREATE INDEX "idx_minecraft_versions_type" ON "minecraft_versions"("version_type", "release_time" DESC);

-- CreateIndex
CREATE INDEX "idx_compat_lookup" ON "compatibility_profiles"("minecraft_version", "device_soc", "gpu_renderer");

-- CreateIndex
CREATE UNIQUE INDEX "uq_java_runtime_arch" ON "java_runtimes"("major_version", "architecture", "vendor");
CREATE INDEX "idx_java_runtimes_version_arch" ON "java_runtimes"("major_version", "architecture");

-- AddForeignKey
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "news_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "minecraft_version_metadata" ADD CONSTRAINT "minecraft_version_metadata_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "minecraft_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compatibility_profiles" ADD CONSTRAINT "compatibility_profiles_minecraft_version_fkey" FOREIGN KEY ("minecraft_version") REFERENCES "minecraft_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
