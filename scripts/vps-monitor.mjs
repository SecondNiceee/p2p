#!/usr/bin/env node
/**
 * VPS P2P Monitor - Standalone background script
 * 
 * Run with: node scripts/vps-monitor.mjs
 * Or with PM2: pm2 start scripts/vps-monitor.mjs --name p2p-monitor
 * 
 * Required environment variables:
 * - DATABASE_URL: Neon database connection string
 * - TELEGRAM_BOT_TOKEN: Telegram bot token
 * - TELEGRAM_CHAT_ID: Telegram chat ID for alerts
 */

import postgres from 'postgres';

// Configuration
const DATABASE_URL = process.env.DATABASE_URL;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const CHECK_INTERVAL_MS = 30000; // Default 30 seconds

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

// Track last alert times to avoid spam (30 second cooldown per type)
const lastAlertTime = { buy: 0, sell: 0 };
const ALERT_COOLDOWN_MS = 30000;

async function sendTelegramAlert(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('[VPS Monitor] Telegram not configured, skipping alert');
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[VPS Monitor] Telegram API error:', errorData);
    } else {
      console.log('[VPS Monitor] Telegram alert sent successfully');
    }
  } catch (error) {
    console.error('[VPS Monitor] Failed to send Telegram alert:', error);
  }
}

async function checkMonitoring() {
  try {
    // Get monitoring config from database
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
      console.log('[VPS Monitor] Monitoring inactive or no config');
      return;
    }

    const cfg = config[0];
    console.log(`[VPS Monitor] Checking prices for ${cfg.fiat_currency}...`);

    // Check BUY alerts (SELL ads - we want to buy USDT)
    if (cfg.buy_target_price) {
      try {
        const response = await fetch('https://walletbot.me/api/v1/p2p/public/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cryptoCurrency: 'USDT',
            fiatCurrency: cfg.fiat_currency,
            side: 'SELL',
            page: 1,
            pageSize: 20,
          }),
        });
        const data = await response.json();

        if (data.status === 'SUCCESS' && data.data) {
          for (const item of data.data) {
            const price = parseFloat(item.price);
            const adMin = parseFloat(item.minAmount);
            const adMax = item.maxAmount ? parseFloat(item.maxAmount) : Infinity;

            const userMin = cfg.buy_fiat_amount_min ? parseFloat(cfg.buy_fiat_amount_min) : null;
            const userMax = cfg.buy_fiat_amount_max ? parseFloat(cfg.buy_fiat_amount_max) : null;

            let withinRange = true;
            if (userMin !== null || userMax !== null) {
              const effectiveUserMin = userMin ?? 0;
              const effectiveUserMax = userMax ?? Infinity;
              withinRange = !(effectiveUserMax < adMin || effectiveUserMin > adMax);
            }

            if (price <= parseFloat(cfg.buy_target_price) && withinRange) {
              const now = Date.now();
              if (now - lastAlertTime.buy > ALERT_COOLDOWN_MS) {
                lastAlertTime.buy = now;
                
                const message =
                  `🛍️ <b>АЛЕРТ ПОКУПКИ (SELL объявление)</b>\n\n` +
                  `💰 Цена: <b>${price} ${cfg.fiat_currency}</b> (цель: ≤${cfg.buy_target_price})\n` +
                  `🪙 Лимиты: ${adMin} - ${adMax === Infinity ? '∞' : adMax} ${cfg.fiat_currency}\n` +
                  `👤 Продавец: <b>${item.nickname}</b>\n` +
                  `⭐ Уровень: ${item.merchantLevel}\n` +
                  `✅ Онлайн: ${item.isOnline ? 'Да' : 'Нет'}\n` +
                  `🔗 <a href="https://t.me/wallet">Перейти</a>`;

                await sendTelegramAlert(message);
                console.log(`[VPS Monitor] BUY alert triggered: ${price} ${cfg.fiat_currency}`);
              }
              break; // Only alert for first matching ad
            }
          }
        }
      } catch (error) {
        console.error('[VPS Monitor] Error fetching SELL ads:', error);
      }
    }

    // Check SELL alerts (BUY ads - we want to sell USDT)
    if (cfg.sell_target_price) {
      try {
        const response = await fetch('https://walletbot.me/api/v1/p2p/public/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cryptoCurrency: 'USDT',
            fiatCurrency: cfg.fiat_currency,
            side: 'BUY',
            page: 1,
            pageSize: 20,
          }),
        });
        const data = await response.json();

        if (data.status === 'SUCCESS' && data.data) {
          for (const item of data.data) {
            const price = parseFloat(item.price);
            const adMin = parseFloat(item.minAmount);
            const adMax = item.maxAmount ? parseFloat(item.maxAmount) : Infinity;

            const userMin = cfg.sell_fiat_amount_min ? parseFloat(cfg.sell_fiat_amount_min) : null;
            const userMax = cfg.sell_fiat_amount_max ? parseFloat(cfg.sell_fiat_amount_max) : null;

            let withinRange = true;
            if (userMin !== null || userMax !== null) {
              const effectiveUserMin = userMin ?? 0;
              const effectiveUserMax = userMax ?? Infinity;
              withinRange = !(effectiveUserMax < adMin || effectiveUserMin > adMax);
            }

            if (price >= parseFloat(cfg.sell_target_price) && withinRange) {
              const now = Date.now();
              if (now - lastAlertTime.sell > ALERT_COOLDOWN_MS) {
                lastAlertTime.sell = now;
                
                const message =
                  `💵 <b>АЛЕРТ ПРОДАЖИ (BUY объявление)</b>\n\n` +
                  `💰 Цена: <b>${price} ${cfg.fiat_currency}</b> (цель: ≥${cfg.sell_target_price})\n` +
                  `🪙 Лимиты: ${adMin} - ${adMax === Infinity ? '∞' : adMax} ${cfg.fiat_currency}\n` +
                  `👤 Покупатель: <b>${item.nickname}</b>\n` +
                  `⭐ Уровень: ${item.merchantLevel}\n` +
                  `✅ Онлайн: ${item.isOnline ? 'Да' : 'Нет'}\n` +
                  `🔗 <a href="https://t.me/wallet">Перейти</a>`;

                await sendTelegramAlert(message);
                console.log(`[VPS Monitor] SELL alert triggered: ${price} ${cfg.fiat_currency}`);
              }
              break; // Only alert for first matching ad
            }
          }
        }
      } catch (error) {
        console.error('[VPS Monitor] Error fetching BUY ads:', error);
      }
    }

    // Update last checked time
    await sql`
      UPDATE monitoring_config
      SET last_checked_at = NOW()
      WHERE id = 1
    `;

  } catch (error) {
    console.error('[VPS Monitor] Check error:', error);
  }
}

// Main loop
async function main() {
  console.log('[VPS Monitor] Starting P2P monitoring service...');
  console.log(`[VPS Monitor] Check interval: ${CHECK_INTERVAL_MS / 1000} seconds`);
  console.log('[VPS Monitor] Press Ctrl+C to stop\n');

  // Initial check
  await checkMonitoring();

  // Schedule recurring checks
  setInterval(checkMonitoring, CHECK_INTERVAL_MS);
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[VPS Monitor] Shutting down...');
  await sql.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[VPS Monitor] Shutting down...');
  await sql.end();
  process.exit(0);
});

main().catch(console.error);
