import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  try {
    const result = await sql`
      SELECT
        is_active,
        fiat_currency,
        buy_target_price,
        buy_fiat_amount,
        sell_target_price,
        sell_fiat_amount,
        interval_ms
      FROM monitoring_config
      WHERE id = 1
    `;

    if (result.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Config not found' }),
        { status: 404 }
      );
    }

    return new Response(JSON.stringify(result[0]), { status: 200 });
  } catch (error) {
    console.error('Failed to get monitoring status:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get status' }),
      { status: 500 }
    );
  }
}
