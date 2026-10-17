-- Push reminders: one row per device, account-level preferences, and a log so nothing is sent twice.
CREATE TABLE `push_subscriptions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `endpoint` varchar(600) NOT NULL,
  `p256dh` varchar(200) NOT NULL,
  `auth` varchar(100) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `push_subscriptions_id` PRIMARY KEY(`id`),
  CONSTRAINT `push_subscriptions_endpoint` UNIQUE(`endpoint`),
  KEY `push_subscriptions_user` (`userId`)
);
CREATE TABLE `notification_prefs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `mealReminders` boolean NOT NULL DEFAULT false,
  `mealTimes` json NOT NULL,
  `symptomCheckins` boolean NOT NULL DEFAULT false,
  `timeZone` varchar(64) NOT NULL DEFAULT 'UTC',
  `updatedAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `notification_prefs_id` PRIMARY KEY(`id`),
  CONSTRAINT `notification_prefs_user` UNIQUE(`userId`)
);
CREATE TABLE `notification_log` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `key` varchar(80) NOT NULL,
  `kind` varchar(16) NOT NULL,
  `sentAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `notification_log_id` PRIMARY KEY(`id`),
  CONSTRAINT `notification_log_user_key` UNIQUE(`userId`,`key`)
);
