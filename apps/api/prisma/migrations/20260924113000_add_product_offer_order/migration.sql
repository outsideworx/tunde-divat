ALTER TABLE "products" ADD COLUMN "offer_order" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "products_offer_order_idx" ON "products"("offer_order");
