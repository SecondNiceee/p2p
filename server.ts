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
        sell_fiat_amount_max
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
    });

    // Fetch SELL ads (for BUY monitoring)
    if (cfg.buy_target_price) {
      try {
        const response = await fetch(
          'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              page: 1,
              rows: 20,
              asset: 'USDT',
              tradeType: 'SELL',
              fiat: cfg.fiat_currency,
              publisherType: null,
            }),
          }
        );
        const data = await response.json();

        if (data.data) {
          for (const item of data.data) {
            const price = parseFloat(item.adv.price);
            const adMin = parseFloat(item.adv.minSingleTransAmount);
            const adMax = parseFloat(item.adv.maxSingleTransAmount);

            // Check if our range intersects with ad's range
            const ourMin = cfg.buy_fiat_amount_min ? parseFloat(cfg.buy_fiat_amount_min) : 0;
            const ourMax = cfg.buy_fiat_amount_max ? parseFloat(cfg.buy_fiat_amount_max) : Infinity;
            const withinRange = !(ourMax < adMin || ourMin > adMax);

            if (price <= cfg.buy_target_price && withinRange) {
              const message =
                `🛍️ <b>АЛЕРТ ПОКУПКИ</b>\n\n` +
                `💰 Цена: <b>${price} ${cfg.fiat_currency}</b> (цель: ≤${cfg.buy_target_price})\n` +
                `🪙 Лимиты объявления: ${adMin} - ${adMax}\n` +
                `👤 Продавец: <b>${item.advertiser.nickName}</b>\n` +
                `⭐ Рейтинг: ${(parseFloat(item.advertiser.monthFinishRate) * 100).toFixed(1)}%\n` +
                `✅ Онлайн: ${item.advertiser.userNo ? 'Да' : 'Нет'}`;

              await sendTelegramAlert(message);

              await sql`
                INSERT INTO alert_logs (type, price, target_price, nickname, min_amount, max_amount, merchant_level, items_count)
                VALUES ('BUY', ${price}, ${cfg.buy_target_price}, ${item.advertiser.nickName}, ${adMin}, ${adMax}, ${item.advertiser.monthFinishRate}, 1)
              `;
            }
          }
        }
      } catch (error) {
        console.error('[Monitoring] Error fetching SELL ads:', error);
      }
    }

    // Fetch BUY ads (for SELL monitoring)
    if (cfg.sell_target_price) {
      try {
        const response = await fetch(
          'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              page: 1,
              rows: 20,
              asset: 'USDT',
              tradeType: 'BUY',
              fiat: cfg.fiat_currency,
              publisherType: null,
            }),
          }
        );
        const data = await response.json();

        if (data.data) {
          for (const item of data.data) {
            const price = parseFloat(item.adv.price);
            const adMin = parseFloat(item.adv.minSingleTransAmount);
            const adMax = parseFloat(item.adv.maxSingleTransAmount);

            // Check if our range intersects with ad's range
            const ourMin = cfg.sell_fiat_amount_min ? parseFloat(cfg.sell_fiat_amount_min) : 0;
            const ourMax = cfg.sell_fiat_amount_max ? parseFloat(cfg.sell_fiat_amount_max) : Infinity;
            const withinRange = !(ourMax < adMin || ourMin > adMax);

            if (price >= cfg.sell_target_price && withinRange) {
              const message =
                `💵 <b>АЛЕРТ ПРОДАЖИ</b>\n\n` +
                `💰 Цена: <b>${price} ${cfg.fiat_currency}</b> (цель: ≥${cfg.sell_target_price})\n` +
                `🪙 Лимиты объявления: ${adMin} - ${adMax}\n` +
                `👤 Покупатель: <b>${item.advertiser.nickName}</b>\n` +
                `⭐ Рейтинг: ${(parseFloat(item.advertiser.monthFinishRate) * 100).toFixed(1)}%\n` +
                `✅ Онлайн: ${item.advertiser.userNo ? 'Да' : 'Нет'}`;

              await sendTelegramAlert(message);

              await sql`
                INSERT INTO alert_logs (type, price, target_price, nickname, min_amount, max_amount, merchant_level, items_count)
                VALUES ('SELL', ${price}, ${cfg.sell_target_price}, ${item.advertiser.nickName}, ${adMin}, ${adMax}, ${item.advertiser.monthFinishRate}, 1)
              `;
            }
          }
        }
      } catch (error) {
        console.error('[Monitoring] Error fetching BUY ads:', error);
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

    // Start monitoring interval (every 60 seconds)
    const intervalMs = parseInt(process.env.MONITORING_INTERVAL || '60000', 10);
    console.log(`[Monitoring] Starting with interval: ${intervalMs}ms`);

    // Run immediately on startup
    runMonitoringCheck();

    // Then run on interval
    monitoringInterval = setInterval(runMonitoringCheck, intervalMs);
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
