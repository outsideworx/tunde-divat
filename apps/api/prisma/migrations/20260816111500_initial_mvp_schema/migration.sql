CREATE TABLE `users` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('ADMIN', 'STAFF') NOT NULL DEFAULT 'ADMIN',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `users_email_key` (`email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `products` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `product_id` VARCHAR(80) NOT NULL,
  `display_number` VARCHAR(20) NOT NULL,
  `price` INTEGER NOT NULL,
  `category` VARCHAR(80) NULL,
  `color` VARCHAR(80) NULL,
  `brand` VARCHAR(80) NULL,
  `description` TEXT NULL,
  `notes` TEXT NULL,
  `target_group` VARCHAR(80) NULL,
  `status` ENUM('DRAFT', 'PROCESSING', 'REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `created_by` INTEGER NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `products_product_id_key` (`product_id`),
  INDEX `products_status_idx` (`status`),
  INDEX `products_display_number_idx` (`display_number`),
  CONSTRAINT `products_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `product_sizes` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `product_fk` INTEGER NOT NULL,
  `size` VARCHAR(20) NOT NULL,
  `quantity` INTEGER NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `product_sizes_product_fk_size_key` (`product_fk`, `size`),
  CONSTRAINT `product_sizes_product_fk_fkey` FOREIGN KEY (`product_fk`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `product_images` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `product_fk` INTEGER NOT NULL,
  `image_type` ENUM('ORIGINAL', 'AI_GENERATED', 'FINAL') NOT NULL,
  `storage_path` VARCHAR(500) NOT NULL,
  `mime_type` VARCHAR(120) NOT NULL,
  `width` INTEGER NULL,
  `height` INTEGER NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `product_images_product_fk_image_type_idx` (`product_fk`, `image_type`),
  CONSTRAINT `product_images_product_fk_fkey` FOREIGN KEY (`product_fk`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `generation_jobs` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `product_fk` INTEGER NOT NULL,
  `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
  `provider` VARCHAR(80) NOT NULL,
  `error_message` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completed_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  INDEX `generation_jobs_product_fk_status_idx` (`product_fk`, `status`),
  CONSTRAINT `generation_jobs_product_fk_fkey` FOREIGN KEY (`product_fk`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
