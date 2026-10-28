ALTER TABLE "product_images" ADD COLUMN "model_size" TEXT;
ALTER TABLE "product_images" ADD COLUMN "model_gender" TEXT;

CREATE INDEX "product_images_product_fk_source_image_id_model_size_model_gender_idx"
  ON "product_images"("product_fk", "source_image_id", "model_size", "model_gender");
