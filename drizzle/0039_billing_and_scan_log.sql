-- Billing page: whether the subscription is set to end, and monthly or yearly.
ALTER TABLE `subscriptions` ADD COLUMN `cancelAtPeriodEnd` boolean NOT NULL DEFAULT false;
ALTER TABLE `subscriptions` ADD COLUMN `billingInterval` varchar(8);
-- One row per counted scan, so the scan counter can show what used the quota.
CREATE TABLE IF NOT EXISTS `scan_events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `kind` varchar(16) NOT NULL,
  `createdAt` bigint NOT NULL,
  CONSTRAINT `scan_events_id` PRIMARY KEY(`id`)
);
CREATE INDEX `scan_events_user_time` ON `scan_events` (`userId`, `createdAt`);
