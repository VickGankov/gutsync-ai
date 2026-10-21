-- Date of birth (YYYY-MM-DD), whether the user wants fitness tracking, and their goal.
-- Existing accounts keep fitness tracking on; new accounts start with it off.
ALTER TABLE `users` ADD COLUMN `birthDate` varchar(10);
ALTER TABLE `users` ADD COLUMN `fitnessEnabled` boolean NOT NULL DEFAULT false;
ALTER TABLE `users` ADD COLUMN `fitnessGoal` varchar(16);
UPDATE `users` SET `fitnessEnabled` = true;
