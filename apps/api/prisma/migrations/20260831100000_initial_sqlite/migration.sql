-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "last_name" TEXT,
    "first_name" TEXT,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "products" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "product_id" TEXT NOT NULL,
    "product_name" TEXT,
    "display_number" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "category" TEXT,
    "color" TEXT,
    "brand" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "target_group" TEXT,
    "reservable_until" DATETIME,
    "reservable_duration_hours" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_by" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "products_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "app_counters" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "next_value" INTEGER NOT NULL,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "pickup_options" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "address" TEXT NOT NULL,
    "start_at" DATETIME NOT NULL,
    "end_at" DATETIME NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "product_fk" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "pickup_fk" INTEGER NOT NULL,
    "size" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PROCUREMENT_PENDING',
    "can_cancel" BOOLEAN NOT NULL DEFAULT true,
    "reserved_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" DATETIME,
    CONSTRAINT "reservations_product_fk_fkey" FOREIGN KEY ("product_fk") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reservations_pickup_fk_fkey" FOREIGN KEY ("pickup_fk") REFERENCES "pickup_options" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "product_sizes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "product_fk" INTEGER NOT NULL,
    "size" TEXT NOT NULL,
    "quantity" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "product_sizes_product_fk_fkey" FOREIGN KEY ("product_fk") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "product_fk" INTEGER NOT NULL,
    "image_type" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_images_product_fk_fkey" FOREIGN KEY ("product_fk") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "generation_jobs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "product_fk" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "error_message" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" DATETIME,
    CONSTRAINT "generation_jobs_product_fk_fkey" FOREIGN KEY ("product_fk") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "products"("status");

-- CreateIndex
CREATE INDEX "products_display_number_idx" ON "products"("display_number");

-- CreateIndex
CREATE UNIQUE INDEX "products_product_id_key" ON "products"("product_id");

-- CreateIndex
CREATE INDEX "pickup_options_is_active_start_at_idx" ON "pickup_options"("is_active", "start_at");

-- CreateIndex
CREATE INDEX "reservations_product_fk_idx" ON "reservations"("product_fk");

-- CreateIndex
CREATE INDEX "reservations_user_id_cancelled_at_idx" ON "reservations"("user_id", "cancelled_at");

-- CreateIndex
CREATE INDEX "reservations_pickup_fk_idx" ON "reservations"("pickup_fk");

-- CreateIndex
CREATE UNIQUE INDEX "product_sizes_product_fk_size_key" ON "product_sizes"("product_fk", "size");

-- CreateIndex
CREATE INDEX "product_images_product_fk_image_type_idx" ON "product_images"("product_fk", "image_type");

-- CreateIndex
CREATE INDEX "generation_jobs_product_fk_status_idx" ON "generation_jobs"("product_fk", "status");
