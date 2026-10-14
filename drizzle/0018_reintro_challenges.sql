-- FODMAP reintroduction challenges. Hand-written like 0014-0016; apply manually.
-- Numbered 0018 because 0017 is used on the feature/fitness-tracking branch.
CREATE TABLE `reintro_challenges` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `foodGroup` varchar(32) NOT NULL,
  `testFood` varchar(100) NOT NULL,
  `doses` json NOT NULL,
  `checkIns` json NOT NULL,
  `status` enum('active','completed','abandoned') NOT NULL DEFAULT 'active',
  `outcome` enum('tolerated','limit','avoid'),
  `toleratedDay` int,
  `lowConfidence` int NOT NULL DEFAULT 0,
  `startedAt` bigint NOT NULL,
  `finishedAt` bigint,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `reintro_challenges_id` PRIMARY KEY(`id`)
);
CREATE INDEX `reintro_challenges_user_status` ON `reintro_challenges` (`userId`, `status`);
