-- Migration: Add missing columns to monitoring_config
-- Run this if you have an existing table

-- Add interval_ms column if not exists
ALTER TABLE monitoring_config ADD COLUMN IF NOT EXISTS interval_ms INTEGER DEFAULT 30000;

-- Add last_checked_at column if not exists
ALTER TABLE monitoring_config ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMP;

-- Remove old columns that no longer exist (optional, ignore errors)
-- ALTER TABLE monitoring_config DROP COLUMN IF EXISTS buy_enabled;
-- ALTER TABLE monitoring_config DROP COLUMN IF EXISTS sell_enabled;
-- ALTER TABLE monitoring_config DROP COLUMN IF EXISTS interval_seconds;
-- ALTER TABLE monitoring_config DROP COLUMN IF EXISTS telegram_chat_id;
-- ALTER TABLE monitoring_config DROP COLUMN IF EXISTS last_buy_alert;
-- ALTER TABLE monitoring_config DROP COLUMN IF EXISTS last_sell_alert;

-- Insert default row if not exists
INSERT INTO monitoring_config (id, is_active, fiat_currency, interval_ms)
VALUES (1, false, 'RUB', 30000)
ON CONFLICT (id) DO NOTHING;
