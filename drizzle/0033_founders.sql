-- Founding members: when the user redeemed the founder code (null = not a founder).
ALTER TABLE `users` ADD COLUMN `founderAt` bigint;
