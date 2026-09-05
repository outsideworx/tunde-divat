-- SQLite does not support ALTER COLUMN, so we recreate the table with the
-- corrected default and copy the data across.

-- Step 1: create the replacement table
CREATE TABLE "users_new" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "last_name" TEXT,
    "first_name" TEXT,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "privacy_accepted_at" DATETIME,
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- Step 2: copy all existing rows
INSERT INTO "users_new"
SELECT "id", "username", "email", "last_name", "first_name", "phone",
       "password_hash", "privacy_accepted_at", "role", "is_active",
       "created_at", "updated_at"
FROM "users";

-- Step 3: swap
DROP TABLE "users";
ALTER TABLE "users_new" RENAME TO "users";

-- Step 4: restore indexes
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_is_active_idx" ON "users"("is_active");
