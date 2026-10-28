CREATE TABLE "bulk_upload_images" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "storage_path" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "view_type" TEXT NOT NULL DEFAULT 'AUTO',
  "uploaded_by" INTEGER,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bulk_upload_images_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "bulk_upload_images_created_at_idx" ON "bulk_upload_images"("created_at");
CREATE INDEX "bulk_upload_images_uploaded_by_idx" ON "bulk_upload_images"("uploaded_by");
