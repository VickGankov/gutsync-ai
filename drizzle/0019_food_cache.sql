-- Shared cache of per-food facts (FODMAP level, hidden ingredients, protein per 100 g).
-- Hand-written like 0014-0018; applied automatically by scripts/migrate-manual.mjs.
CREATE TABLE `food_cache` (
  `id` int AUTO_INCREMENT NOT NULL,
  `foodKey` varchar(120) NOT NULL,
  `name` varchar(120) NOT NULL,
  `category` enum('protein','carb','fat','vegetable','fruit','dairy','grain','other') NOT NULL,
  `fodmap` enum('low','moderate','high') NOT NULL,
  `hiddenIngredients` json NOT NULL,
  `proteinPer100gTenths` int NOT NULL DEFAULT 0,
  `source` enum('seed','ai') NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `food_cache_id` PRIMARY KEY(`id`),
  CONSTRAINT `food_cache_foodKey_unique` UNIQUE(`foodKey`)
);
