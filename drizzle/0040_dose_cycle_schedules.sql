-- Dose schedules beyond "every N days": chosen weekdays, and on/off cycles (e.g. 5 on, 2 off).
ALTER TABLE `dose_schedules` ADD COLUMN `kind` varchar(10) NOT NULL DEFAULT 'interval';
ALTER TABLE `dose_schedules` ADD COLUMN `weekdays` varchar(20);
ALTER TABLE `dose_schedules` ADD COLUMN `cycleOn` int;
ALTER TABLE `dose_schedules` ADD COLUMN `cycleOff` int;
ALTER TABLE `dose_schedules` ADD COLUMN `cycleStart` varchar(10);
