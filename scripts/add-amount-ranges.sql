-- Migration: Change single amount fields to min/max ranges

-- Add new columns for buy amount range
ALTER TABLE monitoring_config ADD COLUMN IF NOT EXISTS buy_fiat_amount_min DECIMAL;
ALTER TABLE monitoring_config ADD COLUMN IF NOT EXISTS buy_fiat_amount_max DECIMAL;

-- Add new columns for sell amount range
ALTER TABLE monitoring_config ADD COLUMN IF NOT EXISTS sell_fiat_amount_min DECIMAL;
ALTER TABLE monitoring_config ADD COLUMN IF NOT EXISTS sell_fiat_amount_max DECIMAL;

-- Migrate existing data (copy old single values to min field)
UPDATE monitoring_config 
SET buy_fiat_amount_min = buy_fiat_amount 
WHERE buy_fiat_amount IS NOT NULL AND buy_fiat_amount_min IS NULL;

UPDATE monitoring_config 
SET sell_fiat_amount_min = sell_fiat_amount 
WHERE sell_fiat_amount IS NOT NULL AND sell_fiat_amount_min IS NULL;

-- Optionally drop old columns (commented out for safety)
-- ALTER TABLE monitoring_config DROP COLUMN IF EXISTS buy_fiat_amount;
-- ALTER TABLE monitoring_config DROP COLUMN IF EXISTS sell_fiat_amount;
