PRAGMA foreign_keys=OFF;

CREATE TABLE "new_product_sizes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "product_fk" INTEGER NOT NULL,
    "color" TEXT,
    "size" TEXT NOT NULL,
    "quantity" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "product_sizes_product_fk_fkey" FOREIGN KEY ("product_fk") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_product_sizes" ("id", "product_fk", "color", "size", "quantity", "created_at", "updated_at")
SELECT "id", "product_fk", NULL, "size", "quantity", "created_at", "updated_at" FROM "product_sizes";

DROP TABLE "product_sizes";
ALTER TABLE "new_product_sizes" RENAME TO "product_sizes";
CREATE UNIQUE INDEX "product_sizes_product_fk_color_size_key" ON "product_sizes"("product_fk", "color", "size");

ALTER TABLE "reservations" ADD COLUMN "color" TEXT;

PRAGMA foreign_keys=ON;
