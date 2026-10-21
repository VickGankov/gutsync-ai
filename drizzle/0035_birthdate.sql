-- Date of birth (YYYY-MM-DD), required at sign-up to confirm the user is 18+.
ALTER TABLE `users` ADD COLUMN `birthDate` varchar(10);
