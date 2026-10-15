-- Per-compound days between doses (set by the user; otherwise inferred from their dose history).
CREATE TABLE `dose_schedules` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `compoundKey` varchar(80) NOT NULL,
  `intervalDays` int NOT NULL,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `dose_schedules_id` PRIMARY KEY(`id`),
  CONSTRAINT `dose_schedules_user_compound` UNIQUE(`userId`,`compoundKey`)
);
