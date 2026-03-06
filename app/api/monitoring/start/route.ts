import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: Request) {
  try {
    const {
      fiatCurrency,
      buyTargetPrice,
      buyFiatAmount,
      sellTargetPrice,
      sellFiatAmount,
      interval_ms,
    } = await request.json();

    // Validate at least one monitoring type is enabled
    if (!buyTargetPrice && !sellTargetPrice) {
      return new Response(
        JSON.stringify({ error: 'At least one target price must be set' }),
        { status: 400 }
      );
    }

    // Check if config exists, if not create it
    const existing = await sql`SELECT id FROM monitoring_config WHERE id = 1`;
    
    if (existing.length === 0) {
      await sql`
        INSERT INTO monitoring_config (id, is_active, fiat_currency, buy_target_price, buy_fiat_amount, sell_target_price, sell_fiat_amount, interval_ms)
        VALUES (1, true, ${fiatCurrency || 'RUB'}, ${buyTargetPrice || null}, ${buyFiatAmount || null}, ${sellTargetPrice || null}, ${sellFiatAmount || null}, ${interval_ms || 30000})
      `;
    } else {
      await sql`
        UPDATE monitoring_config
        SET
          is_active = true,
          fiat_currency = ${fiatCurrency || 'RUB'},
          buy_target_price = ${buyTargetPrice || null},
          buy_fiat_amount = ${buyFiatAmount || null},
          sell_target_price = ${sellTargetPrice || null},
          sell_fiat_amount = ${sellFiatAmount || null},
          interval_ms = ${interval_ms || 30000},
          updated_at = NOW()
        WHERE id = 1
      `;
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Monitoring started' }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Failed to start monitoring:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to start monitoring' }),
      { status: 500 }
    );
  }
}
