ALTER TABLE "product_images" ADD COLUMN "source_image_id" INTEGER;
ALTER TABLE "product_images" ADD COLUMN "is_hidden" BOOLEAN NOT NULL DEFAULT false;
