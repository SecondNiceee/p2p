import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function sendTelegramAlert(message: string) {
  try {
    await fetch('/api/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
  } catch (error) {
    console.error('Failed to send Telegram alert:', error);
  }
}

export async function GET(request: Request) {
  // Verify cron secret
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
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

    if (!config.length || !config[0].is_active) {
      return new Response(JSON.stringify({ message: 'Monitoring inactive' }));
    }

    const cfg = config[0];

    // Fetch SELL ads (for BUY monitoring)
    if (cfg.buy_target_price) {
      try {
        const response = await fetch(
          `https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search?pageIndex=1&pageSize=20&transactionType=SELL&asset=USDT&fiatCurrency=${cfg.fiatCurrency}&tradeType=ONLINE`
        );
        const data = await response.json();

        if (data.data) {
          for (const item of data.data) {
            const price = parseFloat(item.adv.price);
            const minAmount = parseFloat(item.adv.minSingleTransactionAmountUsd);
            const maxAmount = parseFloat(item.adv.maxSingleTransactionAmountUsd);

            const amount = cfg.buy_fiat_amount ? parseFloat(cfg.buy_fiat_amount) : null;

            const withinRange = !amount || (amount >= minAmount && amount <= maxAmount);

            if (price <= cfg.buy_target_price && withinRange) {
              const message =
                `🛍️ <b>АЛЕРТ ПОКУПКИ (SELL объявление)</b>\n\n` +
                `💰 Цена: <b>${price} ${cfg.fiatCurrency}</b> (цель: ${cfg.buy_target_price})\n` +
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
        }
      } catch (error) {
        console.error('Error fetching SELL ads:', error);
      }
    }

    // Fetch BUY ads (for SELL monitoring)
    if (cfg.sell_target_price) {
      try {
        const response = await fetch(
          `https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search?pageIndex=1&pageSize=20&transactionType=BUY&asset=USDT&fiatCurrency=${cfg.fiatCurrency}&tradeType=ONLINE`
        );
        const data = await response.json();

        if (data.data) {
          for (const item of data.data) {
            const price = parseFloat(item.adv.price);
            const minAmount = parseFloat(item.adv.minSingleTransactionAmountUsd);
            const maxAmount = parseFloat(item.adv.maxSingleTransactionAmountUsd);

            const amount = cfg.sell_fiat_amount ? parseFloat(cfg.sell_fiat_amount) : null;

            const withinRange = !amount || (amount >= minAmount && amount <= maxAmount);

            if (price >= cfg.sell_target_price && withinRange) {
              const message =
                `💵 <b>АЛЕРТ ПРОДАЖИ (BUY объявление)</b>\n\n` +
                `💰 Цена: <b>${price} ${cfg.fiatCurrency}</b> (цель: ${cfg.sell_target_price})\n` +
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
        }
      } catch (error) {
        console.error('Error fetching BUY ads:', error);
      }
    }

    // Update last checked time
    await sql`
      UPDATE monitoring_config
      SET last_checked_at = NOW()
      WHERE id = 1
    `;

    return new Response(
      JSON.stringify({ success: true, message: 'Monitoring check completed' }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Cron monitoring error:', error);
    return new Response(
      JSON.stringify({ error: 'Monitoring check failed' }),
      { status: 500 }
    );
  }
}
