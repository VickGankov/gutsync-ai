ALTER TABLE `symptoms`
MODIFY COLUMN `source` ENUM('manual') NOT NULL DEFAULT 'manual';
