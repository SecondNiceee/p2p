# USDT P2P Monitor

Real-time P2P price monitoring for WalletBot with Telegram alerts.

## Features

- Monitor USDT buy/sell prices on P2P markets
- Telegram notifications when target prices are reached
- Persistent monitoring (works even after closing browser)
- Support for multiple fiat currencies (RUB, USD, EUR, KZT, UAH, UZS)

## Setup

### 1. Environment Variables

Create `.env` file:

```env
DATABASE_URL=postgresql://...
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

**Get Telegram credentials:**
1. Create bot via [@BotFather](https://t.me/BotFather) - get `TELEGRAM_BOT_TOKEN`
2. Send message to your bot, then visit `https://api.telegram.org/bot<TOKEN>/getUpdates` - find `chat.id`

### 2. Database Setup

Run the SQL script to create required tables:

```bash
# Using psql
psql $DATABASE_URL -f scripts/setup-monitoring.sql

# Or copy contents of scripts/setup-monitoring.sql and run in your DB console
```

### 3. Install & Run

```bash
# Install dependencies
npm install

# Development (without monitoring)
npm run dev

# Development with monitoring
npm run dev:server

# Production build
npm run build

# Production with monitoring
npm run start:server
```

## How It Works

### Architecture

```
┌─────────────────────────────────────────────┐
│                VPS Server                    │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │         Custom Express Server        │   │
│  │                                      │   │
│  │  ┌──────────┐    ┌───────────────┐  │   │
│  │  │ Next.js  │    │  Monitoring   │  │   │
│  │  │   App    │    │    Loop       │  │   │
│  │  └──────────┘    └───────────────┘  │   │
│  │                         │           │   │
│  └─────────────────────────┼───────────┘   │
│                            │               │
└────────────────────────────┼───────────────┘
                             │
                             ▼
              ┌──────────────────────────┐
              │      Neon Database       │
              │   (monitoring_config)    │
              └──────────────────────────┘
                             │
                             ▼
              ┌──────────────────────────┐
              │     Telegram Bot API     │
              │      (send alerts)       │
              └──────────────────────────┘
```

### Monitoring Flow

1. **Start Monitoring**: Click "Start Monitoring" button in UI
   - Saves config to `monitoring_config` table with `is_active = true`
   
2. **Server Loop**: `server.ts` checks DB every 60 seconds
   - If `is_active = true`, fetches P2P prices from WalletBot API
   - Compares with target prices
   - Sends Telegram alerts if conditions match

3. **Stop Monitoring**: Click "Stop Monitoring" button
   - Sets `is_active = false` in DB
   - Server loop skips checks

4. **Persistence**: When you reopen the site
   - UI fetches `/api/monitoring/status`
   - Restores settings and shows "Stop" button if active

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/monitoring/start` | POST | Start monitoring with config |
| `/api/monitoring/stop` | POST | Stop monitoring |
| `/api/monitoring/status` | GET | Get current monitoring state |
| `/api/telegram` | POST | Send message to Telegram |
| `/api/p2p` | POST | Fetch P2P prices |

## Database Schema

```sql
monitoring_config:
  - id (PRIMARY KEY)
  - is_active (BOOLEAN)
  - fiat_currency (VARCHAR)
  - buy_target_price (DECIMAL)
  - buy_fiat_amount (DECIMAL)
  - sell_target_price (DECIMAL)
  - sell_fiat_amount (DECIMAL)
  - interval_ms (INTEGER)
  - last_checked_at (TIMESTAMP)

alert_logs:
  - id (PRIMARY KEY)
  - created_at (TIMESTAMP)
  - type (VARCHAR)
  - price, target_price (DECIMAL)
  - nickname (VARCHAR)
  - min_amount, max_amount (DECIMAL)
```

## Deployment on VPS

### Using PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Build
npm run build

# Start with PM2
pm2 start "npm run start:server" --name p2p-monitor

# Auto-restart on reboot
pm2 startup
pm2 save

# View logs
pm2 logs p2p-monitor
```

### Using systemd

Create `/etc/systemd/system/p2p-monitor.service`:

```ini
[Unit]
Description=P2P Monitor
After=network.target

[Service]
Type=simple
User=your_user
WorkingDirectory=/path/to/app
ExecStart=/usr/bin/npm run start:server
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable p2p-monitor
sudo systemctl start p2p-monitor
```

## Troubleshooting

**"relation monitoring_config does not exist"**
- Run `scripts/setup-monitoring.sql` on your database

**Telegram messages not sending**
- Check `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set
- Make sure you've started a chat with your bot first

**Monitoring stops when I close browser**
- Use `npm run start:server` (not `npm run dev`)
- Or deploy to VPS with PM2/systemd
