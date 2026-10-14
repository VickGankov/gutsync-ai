-- Fitness tracking: protein/water targets, weigh-ins, quick intake, lifts,
-- plus extra symptom types. Hand-written like 0014-0016; apply with your
-- usual manual migration step.

ALTER TABLE `symptoms`
MODIFY COLUMN `type` ENUM(
  'bloating','abdominal_pain','gas','nausea','fatigue','headache','diarrhea','constipation',
  'acid_reflux','vomiting','low_appetite',
  'energy_boost','better_digestion','improved_mood','better_sleep','clearer_skin','reduced_brain_fog'
) NOT NULL;

CREATE TABLE `fitness_profile` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `proteinTargetG` int NOT NULL DEFAULT 150,
  `waterTargetMl` int NOT NULL DEFAULT 3000,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fitness_profile_id` PRIMARY KEY(`id`),
  CONSTRAINT `fitness_profile_userId_unique` UNIQUE(`userId`)
);

CREATE TABLE `weight_logs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `weightLb10` int NOT NULL,
  `loggedAt` bigint NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `weight_logs_id` PRIMARY KEY(`id`)
);
CREATE INDEX `weight_logs_user_time` ON `weight_logs` (`userId`, `loggedAt`);

CREATE TABLE `intake_logs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `kind` enum('protein','water') NOT NULL,
  `amount` int NOT NULL,
  `loggedAt` bigint NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `intake_logs_id` PRIMARY KEY(`id`)
);
CREATE INDEX `intake_logs_user_time` ON `intake_logs` (`userId`, `loggedAt`);

CREATE TABLE `lift_logs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `exercise` varchar(100) NOT NULL,
  `weightLb` int NOT NULL,
  `reps` int NOT NULL,
  `sets` int NOT NULL DEFAULT 1,
  `notes` text,
  `loggedAt` bigint NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `lift_logs_id` PRIMARY KEY(`id`)
);
CREATE INDEX `lift_logs_user_time` ON `lift_logs` (`userId`, `loggedAt`);
