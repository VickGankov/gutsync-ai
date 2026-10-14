-- Early scans cached branded products under generic names (e.g. a zero-sugar water as "lemonade").
-- Drop AI-learned rows; they are rebuilt on demand. Seed rows are kept.
DELETE FROM `food_cache` WHERE `source` = 'ai';
