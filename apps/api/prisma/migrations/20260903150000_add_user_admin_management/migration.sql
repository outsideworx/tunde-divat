-- AlterTable
ALTER TABLE "users" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");
