ALTER TABLE `products` ADD COLUMN `reservable_duration_hours` INTEGER NULL;

CREATE TABLE `app_counters` (
    `name` VARCHAR(80) NOT NULL,
    `next_value` INTEGER NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `app_counters` (`name`, `next_value`, `updated_at`)
SELECT
  'PUBLIC_DISPLAY_NUMBER',
  GREATEST(COALESCE(MAX(CAST(`display_number` AS UNSIGNED)), 0) + 1, 1),
  CURRENT_TIMESTAMP(3)
FROM `products`
WHERE `display_number` REGEXP '^[0-9]+$';
