-- When (and to which version of the Terms) a user confirmed they are 18+ and agreed.
ALTER TABLE `users` ADD COLUMN `termsVersion` varchar(16);
ALTER TABLE `users` ADD COLUMN `termsAcceptedAt` bigint;
