import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken, STORAGE_LIMIT_FREE, STORAGE_LIMIT_UPGRADED } from '@/lib/auth';
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

    const { data: userData, error } = await supabaseAdmin
      .from('telecloud_users')
      .select('id, email, name, telegram_bot_token, telegram_chat_id, storage_used, storage_limit, is_upgraded, created_at')
      .eq('id', user.id)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 });
    }

    const responseData = {
      ...userData,
      has_telegram_bot: !!(userData.telegram_bot_token && userData.telegram_chat_id),
      telegram_bot_token: '', // Never send token to client
      telegram_chat_id: userData.telegram_chat_id || '',
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
    const { name, telegram_bot_token, telegram_chat_id } = body;

    // Get current user data
    const { data: currentUser } = await supabaseAdmin
      .from('telecloud_users')
      .select('telegram_bot_token, telegram_chat_id, storage_limit, is_upgraded')
      .eq('id', user.id)
      .single();

    // User must be upgraded to configure bot
    if ((telegram_bot_token || telegram_chat_id) && !currentUser?.is_upgraded) {
      return NextResponse.json(
        { error: 'Please upgrade your account to configure your own Telegram bot' },
        { status: 403 }
      );
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (name !== undefined) updates.name = name;

    const hadBot = !!(currentUser?.telegram_bot_token && currentUser?.telegram_chat_id);

    if (telegram_bot_token !== undefined && telegram_bot_token !== '') {
      updates.telegram_bot_token = telegram_bot_token;
    }
    if (telegram_chat_id !== undefined) {
      updates.telegram_chat_id = telegram_chat_id || null;
    }

    const newBotToken = updates.telegram_bot_token !== undefined ? updates.telegram_bot_token : currentUser?.telegram_bot_token;
    const newChatId = updates.telegram_chat_id !== undefined ? updates.telegram_chat_id : currentUser?.telegram_chat_id;
    const willHaveBot = !!(newBotToken && newChatId);

    // Upgraded users with own bot get unlimited storage
    if (currentUser?.is_upgraded && willHaveBot) {
      updates.storage_limit = STORAGE_LIMIT_UPGRADED; // 0 = unlimited
    } else if (!willHaveBot && !currentUser?.is_upgraded) {
      updates.storage_limit = STORAGE_LIMIT_FREE;
    }

    const { data: updatedUser, error } = await supabaseAdmin
      .from('telecloud_users')
      .update(updates)
      .eq('id', user.id)
      .select('id, email, name, storage_used, storage_limit, is_upgraded, created_at')
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

// DELETE - Disable account access (keep data in DB)
export async function DELETE(request: NextRequest) {
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

    // Disable account by setting a flag (keep data)
    await supabaseAdmin
      .from('telecloud_users')
      .update({ is_disabled: true, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    // Clear the auth cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Delete account error:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
