import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { TelegramClient } from '@/lib/telegram';

// GET - List user's messages
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { data: messages } = await supabaseAdmin
      .from('telecloud_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    return NextResponse.json({ messages: messages || [] });
  } catch (error) {
    console.error('Messages error:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

// POST - Send a new message to Telegram channel
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { content } = await request.json();
    if (!content?.trim()) return NextResponse.json({ error: 'Message content required' }, { status: 400 });

    // Get user's telegram settings
    const { data: settings } = await supabaseAdmin
      .from('telecloud_users')
      .select('telegram_bot_token, telegram_chat_id, name')
      .eq('id', user.id)
      .single();

    const botToken = settings?.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = settings?.telegram_chat_id || process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      return NextResponse.json({ error: 'Telegram not configured. Set up in Settings.' }, { status: 400 });
    }

    const tg = new TelegramClient(botToken, chatId);
    const result = await tg.request<{ message_id: number; chat: { title?: string; id: number } }>('sendMessage', {
      chat_id: chatId,
      text: content,
      parse_mode: 'HTML',
    });

    // Store in DB
    const { data: msg, error } = await supabaseAdmin
      .from('telecloud_messages')
      .insert({
        user_id: user.id,
        content: content.trim(),
        telegram_message_id: result.message_id,
        telegram_chat_id: chatId,
        author_name: settings?.name || user.name || user.email.split('@')[0],
        channel_name: result.chat?.title || `Chat ${chatId}`,
        status: 'sent',
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ message: msg });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to send message' }, { status: 500 });
  }
}

// PUT - Edit a message
export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { id, content } = await request.json();
    if (!id || !content?.trim()) return NextResponse.json({ error: 'ID and content required' }, { status: 400 });

    // Get original message
    const { data: msg } = await supabaseAdmin
      .from('telecloud_messages')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!msg) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

    // Edit on Telegram
    if (msg.telegram_message_id && msg.telegram_chat_id) {
      const { data: settings } = await supabaseAdmin
        .from('telecloud_users')
        .select('telegram_bot_token, telegram_chat_id')
        .eq('id', user.id)
        .single();

      const botToken = settings?.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;
      const tg = new TelegramClient(botToken, msg.telegram_chat_id);

      try {
        await tg.request('editMessageText', {
          chat_id: msg.telegram_chat_id,
          message_id: msg.telegram_message_id,
          text: content,
          parse_mode: 'HTML',
        });
      } catch {
        // Telegram edit may fail for old messages
      }
    }

    // Update in DB
    const { data: updated } = await supabaseAdmin
      .from('telecloud_messages')
      .update({ content: content.trim(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    return NextResponse.json({ message: updated });
  } catch (error) {
    console.error('Edit message error:', error);
    return NextResponse.json({ error: 'Failed to edit message' }, { status: 500 });
  }
}

// DELETE - Delete message(s)
export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { ids } = await request.json();
    if (!ids || !Array.isArray(ids)) return NextResponse.json({ error: 'IDs required' }, { status: 400 });

    // Get messages to delete from Telegram
    const { data: msgs } = await supabaseAdmin
      .from('telecloud_messages')
      .select('telegram_message_id, telegram_chat_id')
      .in('id', ids)
      .eq('user_id', user.id);

    // Try to delete from Telegram
    if (msgs && msgs.length > 0) {
      const { data: settings } = await supabaseAdmin
        .from('telecloud_users')
        .select('telegram_bot_token')
        .eq('id', user.id)
        .single();

      const botToken = settings?.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;

      for (const msg of msgs) {
        if (msg.telegram_message_id && msg.telegram_chat_id) {
          try {
            const tg = new TelegramClient(botToken, msg.telegram_chat_id);
            await tg.request('deleteMessage', {
              chat_id: msg.telegram_chat_id,
              message_id: msg.telegram_message_id,
            });
          } catch {
            // May fail for old messages
          }
        }
      }
    }

    // Delete from DB
    await supabaseAdmin
      .from('telecloud_messages')
      .delete()
      .in('id', ids)
      .eq('user_id', user.id);

    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (error) {
    console.error('Delete messages error:', error);
    return NextResponse.json({ error: 'Failed to delete messages' }, { status: 500 });
  }
}
