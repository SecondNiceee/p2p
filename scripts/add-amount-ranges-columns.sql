-- Migration: Add amount range columns to monitoring_config
-- Run this script to add min/max amount columns for buy and sell

ALTER TABLE monitoring_config 
ADD COLUMN IF NOT EXISTS buy_fiat_amount_min numeric,
ADD COLUMN IF NOT EXISTS buy_fiat_amount_max numeric,
ADD COLUMN IF NOT EXISTS sell_fiat_amount_min numeric,
ADD COLUMN IF NOT EXISTS sell_fiat_amount_max numeric;
