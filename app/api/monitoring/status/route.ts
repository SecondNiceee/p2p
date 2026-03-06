import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  try {
    const result = await sql`
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

    if (result.length === 0) {
      // Return default config if none exists
      return new Response(
        JSON.stringify({
          is_active: false,
          fiat_currency: 'RUB',
          buy_target_price: null,
          buy_fiat_amount_min: null,
          buy_fiat_amount_max: null,
          sell_target_price: null,
          sell_fiat_amount_min: null,
          sell_fiat_amount_max: null,
          interval_ms: 30000,
        }),
        { status: 200 }
      );
    }

    return new Response(JSON.stringify(result[0]), { status: 200 });
  } catch (error) {
    console.error('Failed to get monitoring status:', error);
    return new Response(
      JSON.stringify({
        is_active: false,
        fiat_currency: 'RUB',
        buy_target_price: null,
        buy_fiat_amount_min: null,
        buy_fiat_amount_max: null,
        sell_target_price: null,
        sell_fiat_amount_min: null,
        sell_fiat_amount_max: null,
        interval_ms: 30000,
      }),
      { status: 200 }
    );
  }
}
