-- Packaged-product ingredients looked up from Open Food Facts (open data, ODbL), cached by product key.
-- found = 0 rows are negative results, retried after a week.
CREATE TABLE `product_cache` (
  `id` int AUTO_INCREMENT NOT NULL,
  `productKey` varchar(160) NOT NULL,
  `name` varchar(200) NOT NULL,
  `ingredients` json NOT NULL,
  `found` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `product_cache_id` PRIMARY KEY(`id`),
  CONSTRAINT `product_cache_productKey_unique` UNIQUE(`productKey`)
);
