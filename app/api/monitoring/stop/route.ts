import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function POST() {
  try {
    await sql`
      UPDATE monitoring_config
      SET is_active = false, updated_at = NOW()
      WHERE id = 1
    `;

    return new Response(
      JSON.stringify({ success: true, message: 'Monitoring stopped' }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Failed to stop monitoring:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to stop monitoring' }),
      { status: 500 }
    );
  }
}
