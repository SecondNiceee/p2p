import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ==================== MONITORING LOGIC ====================

const sql = neon(process.env.DATABASE_URL!);

// Track current interval to restart when config changes
let currentIntervalMs = 60000;

async function sendTelegramAlert(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error('[Monitoring] Telegram credentials not configured');
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[Monitoring] Telegram API error:', errorData);
    } else {
      console.log('[Monitoring] Telegram alert sent successfully');
    }
  } catch (error) {
    console.error('[Monitoring] Failed to send Telegram alert:', error);
  }
}

// Fetch P2P data from Wallet API (same as client uses)
async function fetchP2PData(fiatCurrency: string, side: 'sell' | 'buy') {
  const apiKey = process.env.P2P_API_KEY;
  
  if (!apiKey) {
    console.error('[Monitoring] P2P_API_KEY not set');
    return null;
  }

  const requestBody = {
    fiatCurrency,
    cryptoCurrency: 'USDT',
    side,
    pageSize: 20,
    page: 0,
  };

  console.log('[Monitoring] P2P Request:', JSON.stringify(requestBody, null, 2));
  console.log('[Monitoring] API Key (first 10 chars):', apiKey.substring(0, 10) + '...');

  try {
    const response = await fetch('https://p2p.walletbot.me/p2p/integration-api/v1/item/online', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('[Monitoring] P2P Response Status:', response.status);
    console.log('[Monitoring] P2P Response Body:', responseText);

    if (!response.ok) {
      console.error('[Monitoring] P2P API error:', response.status, responseText);
      return null;
    }

    const data = JSON.parse(responseText);
    console.log(`[Monitoring] Fetched ${side.toUpperCase()} data: ${data.items?.length || 0} items`);
    return data;
  } catch (error) {
    console.error('[Monitoring] Error fetching P2P data:', error);
    return null;
  }
}

async function runMonitoringCheck() {
  console.log(`[Monitoring] Running check at ${new Date().toISOString()}`);

  try {
    // Get monitoring config
    const config = await sql`
      SELECT
        is_active,
        fiat_currency,
        buy_target_price,
        buy_fiat_amount_min,
        buy_fiat_amount_max,
        sell_target_price,
        sell_fiat_amount_min,
        sell_fiat_amount_max,
        interval_ms
      FROM monitoring_config
      WHERE id = 1
    `;

    if (!config.length || !config[0].is_active) {
      console.log('[Monitoring] Monitoring inactive, skipping');
      return;
    }

    const cfg = config[0];
    console.log('[Monitoring] Config loaded:', {
      fiat: cfg.fiat_currency,
      buyTarget: cfg.buy_target_price,
      sellTarget: cfg.sell_target_price,
      interval: cfg.interval_ms,
    });

    // Check if interval changed and needs restart
    if (cfg.interval_ms && cfg.interval_ms !== currentIntervalMs) {
      console.log(`[Monitoring] Interval changed from ${currentIntervalMs}ms to ${cfg.interval_ms}ms, will restart`);
      currentIntervalMs = cfg.interval_ms;
      restartMonitoringInterval();
    }

    // Fetch SELL ads (for BUY monitoring - user wants to buy, so looks at sell offers)
    if (cfg.buy_target_price) {
      const data = await fetchP2PData(cfg.fiat_currency, 'sell');
      
      if (data?.items) {
        for (const item of data.items) {
          const price = parseFloat(item.price);
          const adMin = parseFloat(item.minDealAmount || '0');
          const adMax = parseFloat(item.maxDealAmount || '999999999');

          // Check if our range intersects with ad's range
          const ourMin = cfg.buy_fiat_amount_min ? parseFloat(cfg.buy_fiat_amount_min) : 0;
          const ourMax = cfg.buy_fiat_amount_max ? parseFloat(cfg.buy_fiat_amount_max) : Infinity;
          const withinRange = !(ourMax < adMin || ourMin > adMax);

          if (price <= cfg.buy_target_price && withinRange) {
            const message =
              `🛍️ <b>АЛЕРТ ПОКУПКИ</b>\n\n` +
              `💰 Цена: <b>${price} ${cfg.fiat_currency}</b> (цель: ≤${cfg.buy_target_price})\n` +
              `🪙 Лимиты объявления: ${adMin} - ${adMax}\n` +
              `👤 Продавец: <b>${item.user?.nickname || 'Unknown'}</b>\n` +
              `⭐ Сделок: ${item.user?.totalDeals || 0}\n` +
              `✅ Онлайн: ${item.user?.online ? 'Да' : 'Нет'}`;

            await sendTelegramAlert(message);

            await sql`
              INSERT INTO alert_logs (type, price, target_price, nickname, min_amount, max_amount, merchant_level, items_count)
              VALUES ('BUY', ${price}, ${cfg.buy_target_price}, ${item.user?.nickname || 'Unknown'}, ${adMin}, ${adMax}, ${item.user?.totalDeals || 0}, 1)
            `;
          }
        }
      }
    }

    // Fetch BUY ads (for SELL monitoring - user wants to sell, so looks at buy offers)
    if (cfg.sell_target_price) {
      const data = await fetchP2PData(cfg.fiat_currency, 'buy');
      
      if (data?.items) {
        for (const item of data.items) {
          const price = parseFloat(item.price);
          const adMin = parseFloat(item.minDealAmount || '0');
          const adMax = parseFloat(item.maxDealAmount || '999999999');

          // Check if our range intersects with ad's range
          const ourMin = cfg.sell_fiat_amount_min ? parseFloat(cfg.sell_fiat_amount_min) : 0;
          const ourMax = cfg.sell_fiat_amount_max ? parseFloat(cfg.sell_fiat_amount_max) : Infinity;
          const withinRange = !(ourMax < adMin || ourMin > adMax);

          if (price >= cfg.sell_target_price && withinRange) {
            const message =
              `💵 <b>АЛЕРТ ПРОДАЖИ</b>\n\n` +
              `💰 Цена: <b>${price} ${cfg.fiat_currency}</b> (цель: ≥${cfg.sell_target_price})\n` +
              `🪙 Лимиты объявления: ${adMin} - ${adMax}\n` +
              `👤 Покупатель: <b>${item.user?.nickname || 'Unknown'}</b>\n` +
              `⭐ Сделок: ${item.user?.totalDeals || 0}\n` +
              `✅ Онлайн: ${item.user?.online ? 'Да' : 'Нет'}`;

            await sendTelegramAlert(message);

            await sql`
              INSERT INTO alert_logs (type, price, target_price, nickname, min_amount, max_amount, merchant_level, items_count)
              VALUES ('SELL', ${price}, ${cfg.sell_target_price}, ${item.user?.nickname || 'Unknown'}, ${adMin}, ${adMax}, ${item.user?.totalDeals || 0}, 1)
            `;
          }
        }
      }
    }

    // Update last checked time
    await sql`
      UPDATE monitoring_config
      SET last_checked_at = NOW()
      WHERE id = 1
    `;

    console.log('[Monitoring] Check completed successfully');
  } catch (error) {
    console.error('[Monitoring] Error:', error);
  }
}

// ==================== SERVER STARTUP ====================

let monitoringInterval: NodeJS.Timeout | null = null;

function restartMonitoringInterval() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }
  console.log(`[Monitoring] Starting interval: ${currentIntervalMs}ms`);
  monitoringInterval = setInterval(runMonitoringCheck, currentIntervalMs);
}

async function initMonitoring() {
  // Get initial interval from database
  try {
    const config = await sql`
      SELECT interval_ms FROM monitoring_config WHERE id = 1
    `;
    if (config.length && config[0].interval_ms) {
      currentIntervalMs = config[0].interval_ms;
    }
  } catch (error) {
    console.log('[Monitoring] Could not load initial config, using default interval');
  }

  console.log(`[Monitoring] Starting with interval: ${currentIntervalMs}ms`);

  // Run immediately on startup
  runMonitoringCheck();

  // Then run on interval
  restartMonitoringInterval();
}

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  }).listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);

    // Initialize monitoring
    initMonitoring();
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }
  process.exit(0);
});
