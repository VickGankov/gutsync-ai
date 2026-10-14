-- Water is now shown in gallons; the default target is 1 gal (3785 ml).
-- Move anyone still on the old 3000 ml default; custom targets are untouched.
UPDATE `fitness_profile` SET `waterTargetMl` = 3785 WHERE `waterTargetMl` = 3000;
ALTER TABLE `fitness_profile` ALTER COLUMN `waterTargetMl` SET DEFAULT 3785;
