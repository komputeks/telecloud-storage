import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { TelegramClient } from '@/lib/telegram';

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

    const { bucket, moveFilesToDefault } = await request.json();

    if (!bucket) {
      return NextResponse.json({ error: 'Bucket name is required' }, { status: 400 });
    }

    if (bucket === 'default') {
      return NextResponse.json({ error: 'Cannot delete default bucket' }, { status: 400 });
    }

    // Get all files in the bucket
    const { data: files } = await supabaseAdmin
      .from('telecloud_files')
      .select('*')
      .eq('user_id', user.id)
      .eq('bucket', bucket);

    if (!files || files.length === 0) {
      // No files, just return success
      return NextResponse.json({ success: true });
    }

    if (moveFilesToDefault) {
      // Move all files to default bucket
      await supabaseAdmin
        .from('telecloud_files')
        .update({ bucket: 'default' })
        .eq('user_id', user.id)
        .eq('bucket', bucket);
    } else {
      // Delete all files from Telegram and database
      // Get user's Telegram credentials
      const { data: userData } = await supabaseAdmin
        .from('telecloud_users')
        .select('telegram_bot_token, telegram_chat_id')
        .eq('id', user.id)
        .single();

      const botToken = userData?.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;
      const chatId = userData?.telegram_chat_id || process.env.TELEGRAM_CHAT_ID;

      if (botToken && chatId) {
        const telegram = new TelegramClient(botToken, chatId);
        
        for (const file of files) {
          try {
            await telegram.deleteMessage(file.telegram_message_id);
          } catch (e) {
            console.error('Failed to delete Telegram message:', e);
          }
        }
      }

      // Delete from database
      await supabaseAdmin
        .from('telecloud_files')
        .delete()
        .eq('user_id', user.id)
        .eq('bucket', bucket);

      // Update user storage
      const totalSize = files.reduce((sum, f) => sum + f.size, 0);
      const { data: currentUser } = await supabaseAdmin
        .from('telecloud_users')
        .select('storage_used')
        .eq('id', user.id)
        .single();

      if (currentUser) {
        await supabaseAdmin
          .from('telecloud_users')
          .update({ storage_used: Math.max(0, currentUser.storage_used - totalSize) })
          .eq('id', user.id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Bucket delete error:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
