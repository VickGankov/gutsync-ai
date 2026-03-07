CREATE TABLE `correlations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`triggerName` varchar(255) NOT NULL,
	`symptomName` varchar(255) NOT NULL,
	`confidence` int NOT NULL,
	`occurrences` int NOT NULL,
	`description` text NOT NULL,
	`recommendation` text NOT NULL,
	`discoveredAt` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `correlations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`photoUrl` text,
	`mealType` enum('breakfast','lunch','dinner','snack') NOT NULL,
	`foods` json NOT NULL,
	`notes` text,
	`loggedAt` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `symptoms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('bloating','abdominal_pain','gas','nausea','fatigue','headache','diarrhea','constipation') NOT NULL,
	`severity` int NOT NULL,
	`source` enum('manual','wearable') NOT NULL DEFAULT 'manual',
	`notes` text,
	`loggedAt` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `symptoms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wearable_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`hrv` int NOT NULL,
	`heartRate` int NOT NULL,
	`sleepQuality` int NOT NULL,
	`stressLevel` int NOT NULL,
	`recordedAt` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wearable_data_id` PRIMARY KEY(`id`)
);
