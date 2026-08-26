ALTER TABLE `products` ADD COLUMN `reservable_until` DATETIME(3) NULL;

CREATE TABLE `pickup_options` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `address` VARCHAR(255) NOT NULL,
    `start_at` DATETIME(3) NOT NULL,
    `end_at` DATETIME(3) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `pickup_options_is_active_start_at_idx`(`is_active`, `start_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `reservations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_fk` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `pickup_fk` INTEGER NOT NULL,
    `size` VARCHAR(20) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `can_cancel` BOOLEAN NOT NULL DEFAULT true,
    `reserved_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `cancelled_at` DATETIME(3) NULL,

    INDEX `reservations_product_fk_idx`(`product_fk`),
    INDEX `reservations_user_id_cancelled_at_idx`(`user_id`, `cancelled_at`),
    INDEX `reservations_pickup_fk_idx`(`pickup_fk`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `reservations` ADD CONSTRAINT `reservations_product_fk_fkey` FOREIGN KEY (`product_fk`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `reservations` ADD CONSTRAINT `reservations_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `reservations` ADD CONSTRAINT `reservations_pickup_fk_fkey` FOREIGN KEY (`pickup_fk`) REFERENCES `pickup_options`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
