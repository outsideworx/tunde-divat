ALTER TABLE "product_images" ADD COLUMN "ai_archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "reservations" ADD COLUMN "fulfilled_at" DATETIME;

CREATE INDEX "reservations_fulfilled_at_idx" ON "reservations"("fulfilled_at");
