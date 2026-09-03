PRAGMA foreign_keys=OFF;

CREATE TABLE "new_reservations" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "product_fk" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "pickup_fk" INTEGER,
    "size" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PROCUREMENT_PENDING',
    "can_cancel" BOOLEAN NOT NULL DEFAULT true,
    "reserved_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" DATETIME,
    CONSTRAINT "reservations_product_fk_fkey" FOREIGN KEY ("product_fk") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reservations_pickup_fk_fkey" FOREIGN KEY ("pickup_fk") REFERENCES "pickup_options" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_reservations" ("can_cancel", "cancelled_at", "id", "pickup_fk", "product_fk", "quantity", "reserved_at", "size", "status", "user_id")
SELECT "can_cancel", "cancelled_at", "id", "pickup_fk", "product_fk", "quantity", "reserved_at", "size", "status", "user_id" FROM "reservations";

DROP TABLE "reservations";
ALTER TABLE "new_reservations" RENAME TO "reservations";

CREATE INDEX "reservations_product_fk_idx" ON "reservations"("product_fk");
CREATE INDEX "reservations_user_id_cancelled_at_idx" ON "reservations"("user_id", "cancelled_at");
CREATE INDEX "reservations_pickup_fk_idx" ON "reservations"("pickup_fk");

PRAGMA foreign_keys=ON;
