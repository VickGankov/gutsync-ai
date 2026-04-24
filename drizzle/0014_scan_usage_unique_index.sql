UPDATE `scan_usage` su
JOIN (
  SELECT `userId`, `usageDate`, SUM(`scanCount`) AS `totalCount`, MIN(`id`) AS `keepId`
  FROM `scan_usage`
  GROUP BY `userId`, `usageDate`
) agg
  ON su.`id` = agg.`keepId`
SET su.`scanCount` = agg.`totalCount`;

DELETE su
FROM `scan_usage` su
JOIN (
  SELECT `userId`, `usageDate`, MIN(`id`) AS `keepId`
  FROM `scan_usage`
  GROUP BY `userId`, `usageDate`
) agg
  ON su.`userId` = agg.`userId`
 AND su.`usageDate` = agg.`usageDate`
WHERE su.`id` <> agg.`keepId`;

ALTER TABLE `scan_usage`
ADD CONSTRAINT `scan_usage_user_date_unique` UNIQUE (`userId`, `usageDate`);
