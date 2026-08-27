ALTER TABLE `users`
  ADD COLUMN `last_name` VARCHAR(80) NULL,
  ADD COLUMN `first_name` VARCHAR(80) NULL,
  ADD COLUMN `phone` VARCHAR(40) NULL;

ALTER TABLE `products`
  ADD COLUMN `product_name` VARCHAR(160) NULL;

CREATE TABLE `app_settings` (
  `key` VARCHAR(80) NOT NULL,
  `value` VARCHAR(500) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
