-- Create monitoring_config table
CREATE TABLE IF NOT EXISTS monitoring_config (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT false,
  
  -- Fiat settings
  fiat_currency VARCHAR(3) DEFAULT 'RUB',
  
  -- Buy monitoring (SELL ads)
  buy_enabled BOOLEAN DEFAULT false,
  buy_target_price DECIMAL,
  buy_fiat_amount DECIMAL,
  
  -- Sell monitoring (BUY ads)
  sell_enabled BOOLEAN DEFAULT false,
  sell_target_price DECIMAL,
  sell_fiat_amount DECIMAL,
  
  -- Interval in seconds
  interval_seconds INTEGER DEFAULT 60,
  
  -- Telegram settings
  telegram_chat_id VARCHAR(255),
  
  -- Track last alert times to prevent spam
  last_buy_alert TIMESTAMP,
  last_sell_alert TIMESTAMP
);

-- Create alert_log table to track sent alerts
CREATE TABLE IF NOT EXISTS alert_logs (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  alert_type VARCHAR(50),
  merchant_nickname VARCHAR(255),
  price DECIMAL,
  fiat_currency VARCHAR(3),
  sent_to_telegram BOOLEAN DEFAULT false
);
