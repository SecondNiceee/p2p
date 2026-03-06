import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const sql = neon(databaseUrl);

async function runMigration() {
  try {
    console.log('Starting migration...');
    
    // Add new columns for buy amount range
    console.log('Adding buy_fiat_amount_min column...');
    await sql`ALTER TABLE monitoring_config ADD COLUMN IF NOT EXISTS buy_fiat_amount_min DECIMAL`;
    
    console.log('Adding buy_fiat_amount_max column...');
    await sql`ALTER TABLE monitoring_config ADD COLUMN IF NOT EXISTS buy_fiat_amount_max DECIMAL`;
    
    // Add new columns for sell amount range
    console.log('Adding sell_fiat_amount_min column...');
    await sql`ALTER TABLE monitoring_config ADD COLUMN IF NOT EXISTS sell_fiat_amount_min DECIMAL`;
    
    console.log('Adding sell_fiat_amount_max column...');
    await sql`ALTER TABLE monitoring_config ADD COLUMN IF NOT EXISTS sell_fiat_amount_max DECIMAL`;
    
    // Migrate existing data
    console.log('Migrating existing data...');
    await sql`UPDATE monitoring_config SET buy_fiat_amount_min = buy_fiat_amount WHERE buy_fiat_amount IS NOT NULL AND buy_fiat_amount_min IS NULL`;
    await sql`UPDATE monitoring_config SET sell_fiat_amount_min = sell_fiat_amount WHERE sell_fiat_amount IS NOT NULL AND sell_fiat_amount_min IS NULL`;
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
