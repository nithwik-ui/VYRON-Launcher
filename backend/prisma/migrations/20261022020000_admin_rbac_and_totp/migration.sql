-- AlterTable
ALTER TABLE "users" ADD COLUMN "role" VARCHAR(32) NOT NULL DEFAULT 'USER',
ADD COLUMN "totp_secret" VARCHAR(128),
ADD COLUMN "is_totp_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "idx_users_role" ON "users"("role");
