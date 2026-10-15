-- Optional waist measurements (tenths of an inch).
CREATE TABLE `waist_logs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `waistIn10` int NOT NULL,
  `loggedAt` bigint NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `waist_logs_id` PRIMARY KEY(`id`)
);
