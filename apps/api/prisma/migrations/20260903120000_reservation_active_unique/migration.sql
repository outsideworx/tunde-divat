-- Enforce "one active reservation per (product, user)" at the database layer.
-- A partial unique index only constrains rows where the reservation is still
-- active (cancelled_at IS NULL), so a user may re-reserve a product after
-- cancelling. Prisma cannot express partial unique indexes, so this is applied
-- as raw SQL and documented in schema.prisma.
CREATE UNIQUE INDEX "reservations_active_product_user_key"
    ON "reservations"("product_fk", "user_id")
    WHERE "cancelled_at" IS NULL;
