# Binance P2P Monitoring Server

Standalone Node.js сервер для мониторинга цен на Binance P2P и отправки алертов в Telegram.

## Преимущества перед Vercel Cron

- Запускается на вашем VPS (полный контроль)
- Работает 24/7 независимо от других сервисов
- Легко управлять логами и процессом
- Может использовать systemd/supervisor для автозагрузки

## Установка

### 1. Подготовка VPS

```bash
cd /path/to/your/vps
mkdir p2p-monitoring
cd p2p-monitoring
```

### 2. Копирование файлов

Скопируй файлы из `scripts/` папки:
- `monitoring-server.ts`
- `package.json`
- `.env.example`

### 3. Установка зависимостей

```bash
npm install
# или
pnpm install
```

### 4. Настройка переменных окружения

```bash
cp .env.example .env
```

Отредактируй `.env` файл с твоими значениями:

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
TELEGRAM_BOT_TOKEN=123456789:ABCDEFGHIJKLmnopqrstuvwxyz
TELEGRAM_CHAT_ID=987654321
```

## Запуск

### Один раз (для тестирования)

```bash
npm start
```

### Как фоновый сервис (systemd)

Создай файл `/etc/systemd/system/p2p-monitoring.service`:

```ini
[Unit]
Description=Binance P2P Monitoring Server
After=network.target

[Service]
Type=simple
User=your_user
WorkingDirectory=/path/to/p2p-monitoring
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Затем:

```bash
sudo systemctl daemon-reload
sudo systemctl enable p2p-monitoring
sudo systemctl start p2p-monitoring
sudo systemctl status p2p-monitoring
```

Логи смотрящь:

```bash
sudo journalctl -u p2p-monitoring -f
```

### С помощью PM2

```bash
npm install -g pm2

pm2 start monitoring-server.ts --name "p2p-monitoring"
pm2 save
pm2 startup
```

## Как это работает

1. Сервер стартует и сразу делает первую проверку цен
2. После этого проверяет каждую минуту (можно изменить `CHECK_INTERVAL_MS`)
3. При нахождении подходящего объявления:
   - Отправляет сообщение в Telegram
   - Сохраняет запись в БД (`alert_logs`)
   - Обновляет `last_checked_at` в `monitoring_config`

## Логи

Сервер выводит детальные логи:

```
[2024-01-15T10:30:45.123Z] Starting monitoring check...
[CONFIG] Monitoring active with config: { fiatCurrency: 'RUB', buyTargetPrice: 50, ...}
[BUY] Fetching SELL ads...
[BUY] Found 20 SELL ads
[BUY] ALERT! Price 48.5 <= target 50
[TELEGRAM] Message sent successfully
[2024-01-15T10:30:48.456Z] Monitoring check completed
```

## Миграция со старого сервера

1. Останови Vercel Cron (удали из `vercel.json` или отключи на сайте Vercel)
2. Запусти этот сервер на VPS
3. Проверь, что алерты приходят в Telegram нормально
4. Можешь удалить `/app/api/cron/` папку (она уже не нужна)

## Обновление

Чтобы обновить мониторинг код:

```bash
# Скопируй новый monitoring-server.ts
git pull origin main
npm install
pm2 restart p2p-monitoring
# или
sudo systemctl restart p2p-monitoring
```

## Troubleshooting

### Сообщения не приходят в Telegram

1. Проверь переменные окружения: `echo $DATABASE_URL` и т.д.
2. Проверь логи сервера
3. Убедись, что бот добавлен в чат
4. Проверь что бот не забанен

### Ошибки подключения к БД

1. Проверь строку подключения в `.env`
2. Убедись что VPS имеет доступ к БД (проверь firewall)
3. Проверь логи: `sudo systemctl status p2p-monitoring`

### Высокая нагрузка на БД

Если проверки идут слишком часто, увеличь `CHECK_INTERVAL_MS` (в миллисекундах):

```typescript
const CHECK_INTERVAL_MS = 120000; // 2 minutes instead of 1
```
