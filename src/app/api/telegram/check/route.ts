import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if user has their own Telegram bot
    const { data: userData } = await supabaseAdmin
      .from('telecloud_users')
      .select('telegram_bot_token, telegram_chat_id')
      .eq('id', user.id)
      .single();

    const hasUserBot = !!(userData?.telegram_bot_token && userData.telegram_chat_id);

    // Check if global bot is configured
    const globalToken = process.env.TELEGRAM_BOT_TOKEN;
    const globalChatId = process.env.TELEGRAM_CHAT_ID;
    const hasGlobalBot = !!(globalToken && globalToken.trim() !== '' && globalChatId && globalChatId.trim() !== '');

    return NextResponse.json({
      hasUserBot,
      hasGlobalBot,
      canUpload: hasUserBot || hasGlobalBot,
    });
  } catch (error) {
    console.error('Check Telegram error:', error);
    return NextResponse.json({ error: 'Failed to check Telegram status' }, { status: 500 });
  }
}
