-- Dose log (medication / peptide), dose interval setting, and three side-effect symptom types.
CREATE TABLE `dose_logs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `compound` varchar(80) NOT NULL,
  `doseMcg` int NOT NULL,
  `site` varchar(32),
  `notes` text,
  `loggedAt` bigint NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `dose_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `dose_logs_user_time` ON `dose_logs` (`userId`, `loggedAt`);
--> statement-breakpoint
ALTER TABLE `fitness_profile` ADD `doseIntervalDays` int NOT NULL DEFAULT 7;
--> statement-breakpoint
ALTER TABLE `symptoms` MODIFY COLUMN `type` enum('bloating','abdominal_pain','gas','nausea','fatigue','headache','diarrhea','constipation','acid_reflux','vomiting','low_appetite','energy_boost','better_digestion','improved_mood','better_sleep','clearer_skin','reduced_brain_fog','injection_site_reaction','dizziness','racing_heart') NOT NULL;
