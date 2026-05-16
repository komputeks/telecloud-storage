import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { bot_token, chat_id } = await request.json();

    if (!bot_token) {
      return NextResponse.json({ success: false, error: 'Bot token is required' });
    }

    // Test getting bot info
    const botInfoRes = await fetch(`https://api.telegram.org/bot${bot_token}/getMe`);
    const botInfo = await botInfoRes.json();

    if (!botInfo.ok) {
      return NextResponse.json({ 
        success: false, 
        error: botInfo.description || 'Invalid bot token' 
      });
    }

    // If chat_id provided, test sending a message
    if (chat_id) {
      const testMsgRes = await fetch(`https://api.telegram.org/bot${bot_token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chat_id,
          text: '✅ TeleCloud connection test successful!\\n\\nYour bot is ready to store files.\\n👤 By: TeleCloud System',
        }),
      });

      const testMsg = await testMsgRes.json();

      if (!testMsg.ok) {
        return NextResponse.json({ 
          success: false, 
          error: testMsg.description || 'Failed to send message to chat. Make sure the bot is added to the channel/group.' 
        });
      }

      return NextResponse.json({ 
        success: true, 
        bot_username: botInfo.result.username,
        chat_id: chat_id
      });
    }

    return NextResponse.json({ 
      success: true, 
      bot_username: botInfo.result.username 
    });
  } catch (error) {
    console.error('Telegram test error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to connect to Telegram API' 
    });
  }
}
