-- Invite codes: each code grants a plan (founder or tester) with its own cap and optional expiry.
ALTER TABLE `users` ADD COLUMN `testerAt` bigint;
CREATE TABLE `invite_codes` (
  `id` int AUTO_INCREMENT NOT NULL,
  `code` varchar(64) NOT NULL,
  `plan` varchar(16) NOT NULL,
  `cap` int NOT NULL,
  `redeemed` int NOT NULL DEFAULT 0,
  `expiresAt` bigint,
  `label` varchar(120),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `invite_codes_id` PRIMARY KEY(`id`),
  CONSTRAINT `invite_codes_code_unique` UNIQUE(`code`)
);
