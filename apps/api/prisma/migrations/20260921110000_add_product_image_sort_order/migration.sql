ALTER TABLE "product_images" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

UPDATE "product_images"
SET "sort_order" = "id"
WHERE "sort_order" = 0;

CREATE INDEX "product_images_product_fk_sort_order_idx" ON "product_images"("product_fk", "sort_order");
