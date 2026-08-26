ALTER TABLE `users` ADD COLUMN `username` VARCHAR(40) NULL;

UPDATE `users`
SET `username` = CASE
  WHEN `email` = 'admin@example.com' THEN 'admin123'
  ELSE CONCAT('user', `id`)
END
WHERE `username` IS NULL;

ALTER TABLE `users` MODIFY `username` VARCHAR(40) NOT NULL;
ALTER TABLE `users` MODIFY `email` VARCHAR(255) NULL;
CREATE UNIQUE INDEX `users_username_key` ON `users` (`username`);
