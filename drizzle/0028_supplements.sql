-- The user's own supplement checklist and the days each item was taken.
CREATE TABLE `supplements` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `name` varchar(60) NOT NULL,
  `archived` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `supplements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supplement_logs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `supplementId` int NOT NULL,
  `dateKey` varchar(10) NOT NULL,
  `loggedAt` bigint NOT NULL,
  CONSTRAINT `supplement_logs_id` PRIMARY KEY(`id`),
  CONSTRAINT `supplement_logs_once` UNIQUE(`supplementId`,`dateKey`)
);
