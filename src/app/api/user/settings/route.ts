import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const STORAGE_LIMIT_WITH_BOT = 107374182400; // 100GB
const STORAGE_LIMIT_WITHOUT_BOT = 10737418240; // 10GB

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

    const { data: userData, error } = await supabaseAdmin
      .from('telecloud_users')
      .select('id, email, name, telegram_bot_token, telegram_chat_id, telegram_api_id, telegram_api_hash, telegram_phone, telegram_use_userbot, storage_used, storage_limit, created_at')
      .eq('id', user.id)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 });
    }

    // Don't expose the full bot token - send boolean flags instead
    const responseData = {
      ...userData,
      has_telegram_bot: !!(userData.telegram_bot_token && userData.telegram_chat_id),
      has_telegram_api: !!(userData.telegram_api_id && userData.telegram_api_hash),
      telegram_bot_token: '', // Never send token to client
      telegram_api_hash: '', // Never send hash to client
      telegram_api_id: userData.telegram_api_id || '',
      telegram_chat_id: userData.telegram_chat_id || '',
      telegram_phone: userData.telegram_phone || '',
    };

    return NextResponse.json({ settings: responseData });
  } catch (error) {
    console.error('Get user settings error:', error);
    return NextResponse.json({ error: 'Failed to get user settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
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

    const body = await request.json();
    const { name, telegram_bot_token, telegram_chat_id, telegram_api_id, telegram_api_hash, telegram_phone, telegram_use_userbot } = body;

    // Get current user data
    const { data: currentUser } = await supabaseAdmin
      .from('telecloud_users')
      .select('telegram_bot_token, telegram_chat_id, storage_limit')
      .eq('id', user.id)
      .single();

    // Build update object
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    
    if (name !== undefined) updates.name = name;
    
    // Handle Telegram configuration
    const hadBot = !!(currentUser?.telegram_bot_token && currentUser?.telegram_chat_id);
    
    // Only update telegram_bot_token if provided and not empty (to avoid overwriting with empty string from masked display)
    if (telegram_bot_token !== undefined && telegram_bot_token !== '') {
      updates.telegram_bot_token = telegram_bot_token;
    }
    if (telegram_chat_id !== undefined) {
      updates.telegram_chat_id = telegram_chat_id || null;
    }
    // Only update API hash if provided and not empty
    if (telegram_api_id !== undefined) {
      updates.telegram_api_id = telegram_api_id || null;
    }
    if (telegram_api_hash !== undefined && telegram_api_hash !== '') {
      updates.telegram_api_hash = telegram_api_hash;
    }
    if (telegram_phone !== undefined) {
      updates.telegram_phone = telegram_phone || null;
    }
    if (telegram_use_userbot !== undefined) {
      updates.telegram_use_userbot = telegram_use_userbot;
    }
    
    // Determine if user will have bot after this update
    const newBotToken = updates.telegram_bot_token !== undefined ? updates.telegram_bot_token : currentUser?.telegram_bot_token;
    const newChatId = updates.telegram_chat_id !== undefined ? updates.telegram_chat_id : currentUser?.telegram_chat_id;
    const willHaveBot = !!(newBotToken && newChatId);
    
    // Update storage limit based on bot configuration
    if (!hadBot && willHaveBot) {
      // User added a bot - upgrade to 100GB
      updates.storage_limit = STORAGE_LIMIT_WITH_BOT;
    } else if (hadBot && !willHaveBot) {
      // User removed their bot - downgrade to 10GB
      updates.storage_limit = STORAGE_LIMIT_WITHOUT_BOT;
    }

    const { data: updatedUser, error } = await supabaseAdmin
      .from('telecloud_users')
      .update(updates)
      .eq('id', user.id)
      .select('id, email, name, storage_used, storage_limit, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }

    return NextResponse.json({ 
      user: updatedUser, 
      success: true,
      storage_upgraded: !hadBot && willHaveBot,
    });
  } catch (error) {
    console.error('Update user settings error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
