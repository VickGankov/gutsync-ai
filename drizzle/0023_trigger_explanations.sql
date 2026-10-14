-- AI explanations for detected triggers, cached per user and trigger.
-- statsHash records the counts the text was written from; it is regenerated when the counts change.
CREATE TABLE `trigger_explanations` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `triggerKey` varchar(255) NOT NULL,
  `statsHash` varchar(40) NOT NULL,
  `explanation` json NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `trigger_explanations_id` PRIMARY KEY(`id`),
  CONSTRAINT `trigger_explanations_user_key` UNIQUE(`userId`,`triggerKey`)
);
