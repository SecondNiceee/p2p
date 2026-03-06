-- Migration: Add min/max amount columns for buy and sell
-- Run this to add the new amount range columns

ALTER TABLE monitoring_config 
ADD COLUMN IF NOT EXISTS buy_fiat_amount_min DECIMAL(18, 8),
ADD COLUMN IF NOT EXISTS buy_fiat_amount_max DECIMAL(18, 8),
ADD COLUMN IF NOT EXISTS sell_fiat_amount_min DECIMAL(18, 8),
ADD COLUMN IF NOT EXISTS sell_fiat_amount_max DECIMAL(18, 8);

-- If you have old buy_fiat_amount and sell_fiat_amount columns, 
-- you can migrate them and then drop (optional):
-- UPDATE monitoring_config SET buy_fiat_amount_min = buy_fiat_amount, buy_fiat_amount_max = buy_fiat_amount WHERE buy_fiat_amount IS NOT NULL;
-- UPDATE monitoring_config SET sell_fiat_amount_min = sell_fiat_amount, sell_fiat_amount_max = sell_fiat_amount WHERE sell_fiat_amount IS NOT NULL;
-- ALTER TABLE monitoring_config DROP COLUMN buy_fiat_amount, DROP COLUMN sell_fiat_amount;
