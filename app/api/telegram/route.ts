export async function POST(request: Request) {
  const { message } = await request.json();

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return Response.json(
      { error: 'Telegram credentials not configured' },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.statusText}`);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Telegram notification error:', error);
    return Response.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
