-- Blood work results, plus an optional dose on supplements so dose changes show up next to lab trends.
ALTER TABLE `supplements` ADD COLUMN `dose` varchar(40);
--> statement-breakpoint
ALTER TABLE `supplement_logs` ADD COLUMN `dose` varchar(40);
--> statement-breakpoint
CREATE TABLE `lab_results` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `marker` varchar(60) NOT NULL,
  `value` double NOT NULL,
  `unit` varchar(24) NOT NULL,
  `refLow` double,
  `refHigh` double,
  `drawnOn` varchar(10) NOT NULL,
  `notes` varchar(200),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `lab_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `lab_results_user_marker` ON `lab_results` (`userId`,`marker`);
