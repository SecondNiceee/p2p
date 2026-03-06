# Migration Guide: Price Range Support

## What Changed

Your alerts system has been updated to support price ranges instead of single amounts. All changes are already in the code.

## Required Database Migration

You need to add 4 new columns to your `monitoring_config` table:
- `buy_fiat_amount_min` (numeric)
- `buy_fiat_amount_max` (numeric)
- `sell_fiat_amount_min` (numeric)
- `sell_fiat_amount_max` (numeric)

### Option 1: Run Migration on Vercel Dashboard

1. Go to your Neon database dashboard
2. Open the SQL Editor
3. Run this query:

```sql
ALTER TABLE monitoring_config 
ADD COLUMN IF NOT EXISTS buy_fiat_amount_min numeric,
ADD COLUMN IF NOT EXISTS buy_fiat_amount_max numeric,
ADD COLUMN IF NOT EXISTS sell_fiat_amount_min numeric,
ADD COLUMN IF NOT EXISTS sell_fiat_amount_max numeric;
```

### Option 2: Run Migration from Your VPS

```bash
# Set your DATABASE_URL environment variable
export DATABASE_URL="your-neon-connection-string"

# Run the migration script
node /path/to/scripts/migrate-to-ranges.js
```

## How to Use

### In Web UI
- **Buy Amount**: Enter min and max values in the two input fields
- **Sell Amount**: Enter min and max values in the two input fields
- The alert will trigger when there's an intersection between your range and the seller's available range

### In VPS (server.ts)
The VPS monitoring script automatically uses these new columns. No code changes needed - just ensure DATABASE_URL is set.

```bash
# On your VPS
export DATABASE_URL="your-neon-connection-string"
node server.ts
```

## Alert Text Fixes

The alert messages now show the correct comparison operators:
- **BUY Alert**: "Найдено X SELL объявлений с ценой ≤ [price]" (≤ means cheaper is better)
- **SELL Alert**: "Найдено X BUY объявлений с ценой ≥ [price]" (≥ means higher price is better for selling)
