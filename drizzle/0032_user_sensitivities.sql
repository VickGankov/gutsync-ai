-- Foods the user says they suspect (list of keys from shared/sensitivities.ts).
ALTER TABLE `users` ADD COLUMN `sensitivities` json;
