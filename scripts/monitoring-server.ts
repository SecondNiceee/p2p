import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL!);

// Configuration
const CHECK_INTERVAL_MS = 60000; // 1 minute
const BINANCE_API_BASE = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';

async function sendTelegramAlert(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error('[TELEGRAM] Missing credentials - TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
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
      console.error('[TELEGRAM] API error:', errorData);
    } else {
      console.log('[TELEGRAM] Message sent successfully');
    }
  } catch (error) {
    console.error('[TELEGRAM] Failed to send alert:', error);
  }
}

async function checkPrices(): Promise<void> {
  try {
    console.log(`[${new Date().toISOString()}] Starting monitoring check...`);

    // Get monitoring config
    const config = await sql`
      SELECT
        is_active,
        fiat_currency,
        buy_target_price,
        buy_fiat_amount,
        sell_target_price,
        sell_fiat_amount
      FROM monitoring_config
      WHERE id = 1
    `;

    if (!config.length) {
      console.log('[CONFIG] No monitoring config found');
      return;
    }

    if (!config[0].is_active) {
      console.log('[CONFIG] Monitoring is inactive');
      return;
    }

    const cfg = config[0];
    console.log('[CONFIG] Monitoring active with config:', {
      fiatCurrency: cfg.fiat_currency,
      buyTargetPrice: cfg.buy_target_price,
      sellTargetPrice: cfg.sell_target_price,
    });

    // Fetch SELL ads (for BUY monitoring)
    if (cfg.buy_target_price) {
      try {
        console.log('[BUY] Fetching SELL ads...');
        const response = await fetch(
          `${BINANCE_API_BASE}?pageIndex=1&pageSize=20&transactionType=SELL&asset=USDT&fiatCurrency=${cfg.fiat_currency}&tradeType=ONLINE`
        );
        const data = await response.json();

        if (data.data && data.data.length > 0) {
          console.log(`[BUY] Found ${data.data.length} SELL ads`);

          for (const item of data.data) {
            const price = parseFloat(item.adv.price);
            const minAmount = parseFloat(item.adv.minSingleTransactionAmountUsd);
            const maxAmount = parseFloat(item.adv.maxSingleTransactionAmountUsd);

            const amount = cfg.buy_fiat_amount ? parseFloat(cfg.buy_fiat_amount) : null;
            const withinRange = !amount || (amount >= minAmount && amount <= maxAmount);

            if (price <= cfg.buy_target_price && withinRange) {
              console.log(`[BUY] ALERT! Price ${price} <= target ${cfg.buy_target_price}`);

              const message =
                `🛍️ <b>АЛЕРТ ПОКУПКИ (SELL объявление)</b>\n\n` +
                `💰 Цена: <b>${price} ${cfg.fiat_currency}</b> (цель: ${cfg.buy_target_price})\n` +
                `🪙 Минимум: ${minAmount} | Максимум: ${maxAmount}\n` +
                `👤 Продавец: <b>${item.advertiser.nickName}</b>\n` +
                `⭐ Уровень: ${item.advertiser.monthFinishRate}\n` +
                `✅ Онлайн: ${item.advertiser.isOnline ? 'Да' : 'Нет'}\n` +
                `🔗 <a href="https://t.me/wallet">Перейти</a>`;

              await sendTelegramAlert(message);

              // Log alert
              await sql`
                INSERT INTO alert_logs (type, price, target_price, nickname, min_amount, max_amount, merchant_level, items_count)
                VALUES ('BUY', ${price}, ${cfg.buy_target_price}, ${item.advertiser.nickName}, ${minAmount}, ${maxAmount}, ${item.advertiser.monthFinishRate}, 1)
              `;
            }
          }
        } else {
          console.log('[BUY] No SELL ads found');
        }
      } catch (error) {
        console.error('[BUY] Error fetching SELL ads:', error);
      }
    }

    // Fetch BUY ads (for SELL monitoring)
    if (cfg.sell_target_price) {
      try {
        console.log('[SELL] Fetching BUY ads...');
        const response = await fetch(
          `${BINANCE_API_BASE}?pageIndex=1&pageSize=20&transactionType=BUY&asset=USDT&fiatCurrency=${cfg.fiat_currency}&tradeType=ONLINE`
        );
        const data = await response.json();

        if (data.data && data.data.length > 0) {
          console.log(`[SELL] Found ${data.data.length} BUY ads`);

          for (const item of data.data) {
            const price = parseFloat(item.adv.price);
            const minAmount = parseFloat(item.adv.minSingleTransactionAmountUsd);
            const maxAmount = parseFloat(item.adv.maxSingleTransactionAmountUsd);

            const amount = cfg.sell_fiat_amount ? parseFloat(cfg.sell_fiat_amount) : null;
            const withinRange = !amount || (amount >= minAmount && amount <= maxAmount);

            if (price >= cfg.sell_target_price && withinRange) {
              console.log(`[SELL] ALERT! Price ${price} >= target ${cfg.sell_target_price}`);

              const message =
                `💵 <b>АЛЕРТ ПРОДАЖИ (BUY объявление)</b>\n\n` +
                `💰 Цена: <b>${price} ${cfg.fiat_currency}</b> (цель: ${cfg.sell_target_price})\n` +
                `🪙 Минимум: ${minAmount} | Максимум: ${maxAmount}\n` +
                `👤 Покупатель: <b>${item.advertiser.nickName}</b>\n` +
                `⭐ Уровень: ${item.advertiser.monthFinishRate}\n` +
                `✅ Онлайн: ${item.advertiser.isOnline ? 'Да' : 'Нет'}\n` +
                `🔗 <a href="https://t.me/wallet">Перейти</a>`;

              await sendTelegramAlert(message);

              // Log alert
              await sql`
                INSERT INTO alert_logs (type, price, target_price, nickname, min_amount, max_amount, merchant_level, items_count)
                VALUES ('SELL', ${price}, ${cfg.sell_target_price}, ${item.advertiser.nickName}, ${minAmount}, ${maxAmount}, ${item.advertiser.monthFinishRate}, 1)
              `;
            }
          }
        } else {
          console.log('[SELL] No BUY ads found');
        }
      } catch (error) {
        console.error('[SELL] Error fetching BUY ads:', error);
      }
    }

    // Update last checked time
    await sql`
      UPDATE monitoring_config
      SET last_checked_at = NOW()
      WHERE id = 1
    `;

    console.log(`[${new Date().toISOString()}] Monitoring check completed`);
  } catch (error) {
    console.error('[ERROR] Monitoring check failed:', error);
  }
}

async function main(): Promise<void> {
  console.log('='.repeat(50));
  console.log('BINANCE P2P MONITORING SERVER');
  console.log('='.repeat(50));
  console.log(`Starting at ${new Date().toISOString()}`);
  console.log(`Check interval: ${CHECK_INTERVAL_MS / 1000} seconds`);
  console.log('='.repeat(50));

  // Validate environment variables
  if (!process.env.DATABASE_URL) {
    console.error('[ERROR] DATABASE_URL not set');
    process.exit(1);
  }

  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    console.warn('[WARN] Telegram credentials not set - alerts will not be sent');
  }

  // Run initial check immediately
  await checkPrices();

  // Set up interval for continuous monitoring
  setInterval(checkPrices, CHECK_INTERVAL_MS);

  console.log('[INFO] Monitoring server is running. Press Ctrl+C to stop.');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[INFO] Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[INFO] Shutting down...');
  process.exit(0);
});

main().catch((error) => {
  console.error('[FATAL] Failed to start server:', error);
  process.exit(1);
});
