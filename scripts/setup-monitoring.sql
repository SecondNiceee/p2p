-- Create monitoring_config table
CREATE TABLE IF NOT EXISTS monitoring_config (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT false,
  
  -- Fiat settings
  fiat_currency VARCHAR(10) DEFAULT 'RUB',
  
  -- Buy monitoring (SELL ads)
  buy_target_price DECIMAL,
  buy_fiat_amount DECIMAL,
  
  -- Sell monitoring (BUY ads)
  sell_target_price DECIMAL,
  sell_fiat_amount DECIMAL,
  
  -- Interval in milliseconds
  interval_ms INTEGER DEFAULT 30000,
  
  -- Track last check time
  last_checked_at TIMESTAMP
);

-- Create alert_logs table to track sent alerts
CREATE TABLE IF NOT EXISTS alert_logs (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  type VARCHAR(10),
  price DECIMAL,
  target_price DECIMAL,
  nickname VARCHAR(255),
  min_amount DECIMAL,
  max_amount DECIMAL,
  merchant_level VARCHAR(50),
  items_count INTEGER
);

-- Insert default config row if not exists
INSERT INTO monitoring_config (id, is_active, fiat_currency, interval_ms)
VALUES (1, false, 'RUB', 30000)
ON CONFLICT (id) DO NOTHING;
