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
      interval,
    } = await request.json();

    // Validate at least one monitoring type is enabled
    if (!buyTargetPrice && !sellTargetPrice) {
      return new Response(
        JSON.stringify({ error: 'At least one target price must be set' }),
        { status: 400 }
      );
    }

    // Update monitoring config
    await sql`
      UPDATE monitoring_config
      SET
        is_active = true,
        fiat_currency = ${fiatCurrency},
        buy_target_price = ${buyTargetPrice ? parseFloat(buyTargetPrice) : null},
        buy_fiat_amount = ${buyFiatAmount ? parseFloat(buyFiatAmount) : null},
        sell_target_price = ${sellTargetPrice ? parseFloat(sellTargetPrice) : null},
        sell_fiat_amount = ${sellFiatAmount ? parseFloat(sellFiatAmount) : null},
        interval_ms = ${interval || 30000},
        updated_at = NOW()
      WHERE id = 1
    `;

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
