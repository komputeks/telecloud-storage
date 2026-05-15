import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { TelegramClient } from '@/lib/telegram';

// Rename bucket
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

    const { oldName, newName } = await request.json();

    if (!oldName || !newName) {
      return NextResponse.json({ error: 'Bucket names are required' }, { status: 400 });
    }

    if (oldName === 'default') {
      return NextResponse.json({ error: 'Cannot rename default bucket' }, { status: 400 });
    }

    // Update all files in the bucket
    const { error } = await supabaseAdmin
      .from('telecloud_files')
      .update({ bucket: newName })
      .eq('user_id', user.id)
      .eq('bucket', oldName);

    if (error) {
      return NextResponse.json({ error: 'Failed to rename bucket' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Bucket rename error:', error);
    return NextResponse.json({ error: 'Failed to rename bucket' }, { status: 500 });
  }
}

// Delete bucket or move files
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

    const { bucketName, moveFilesTo } = await request.json();

    if (!bucketName) {
      return NextResponse.json({ error: 'Bucket name is required' }, { status: 400 });
    }

    if (bucketName === 'default') {
      return NextResponse.json({ error: 'Cannot delete default bucket' }, { status: 400 });
    }

    // Get user's Telegram credentials
    const { data: userData } = await supabaseAdmin
      .from('telecloud_users')
      .select('telegram_bot_token, telegram_chat_id')
      .eq('id', user.id)
      .single();

    const botToken = userData?.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = userData?.telegram_chat_id || process.env.TELEGRAM_CHAT_ID;

    if (moveFilesTo) {
      // Move files to another bucket
      const { error } = await supabaseAdmin
        .from('telecloud_files')
        .update({ bucket: moveFilesTo })
        .eq('user_id', user.id)
        .eq('bucket', bucketName);

      if (error) {
        return NextResponse.json({ error: 'Failed to move files' }, { status: 500 });
      }
    } else {
      // Delete all files in the bucket
      const { data: files } = await supabaseAdmin
        .from('telecloud_files')
        .select('*')
        .eq('user_id', user.id)
        .eq('bucket', bucketName);

      if (files && files.length > 0 && botToken && chatId) {
        const telegram = new TelegramClient(botToken, chatId);

        for (const file of files) {
          // Delete from Telegram
          try {
            await telegram.deleteMessage(file.telegram_message_id);
          } catch (err) {
            console.error('Failed to delete Telegram message:', err);
          }

          // Update user storage
          const { data: currentUser } = await supabaseAdmin
            .from('telecloud_users')
            .select('storage_used')
            .eq('id', user.id)
            .single();

          if (currentUser) {
            await supabaseAdmin
              .from('telecloud_users')
              .update({ storage_used: Math.max(0, currentUser.storage_used - file.size) })
              .eq('id', user.id);
          }
        }
      }

      // Delete from database
      await supabaseAdmin
        .from('telecloud_files')
        .delete()
        .eq('user_id', user.id)
        .eq('bucket', bucketName);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Bucket delete error:', error);
    return NextResponse.json({ error: 'Failed to delete bucket' }, { status: 500 });
  }
}
