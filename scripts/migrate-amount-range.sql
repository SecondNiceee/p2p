-- Add min/max amount fields for range
ALTER TABLE monitoring_config 
ADD COLUMN IF NOT EXISTS buy_fiat_amount_min DECIMAL,
ADD COLUMN IF NOT EXISTS buy_fiat_amount_max DECIMAL,
ADD COLUMN IF NOT EXISTS sell_fiat_amount_min DECIMAL,
ADD COLUMN IF NOT EXISTS sell_fiat_amount_max DECIMAL;
