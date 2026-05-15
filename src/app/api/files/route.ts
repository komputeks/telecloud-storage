import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { TelegramClient } from '@/lib/telegram';

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

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('id');

    if (fileId) {
      // Get single file
      const { data: file, error } = await supabaseAdmin
        .from('files')
        .select('*')
        .eq('id', fileId)
        .eq('user_id', user.id)
        .single();

      if (error || !file) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }

      return NextResponse.json({ file });
    }

    // List files
    const bucket = searchParams.get('bucket') || 'default';
    const prefix = searchParams.get('prefix') || '';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabaseAdmin
      .from('files')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('bucket', bucket)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (prefix) {
      query = query.like('key', `${prefix}%`);
    }

    const { data: files, count } = await query;

    // Get buckets
    const { data: bucketData } = await supabaseAdmin
      .from('files')
      .select('bucket, size')
      .eq('user_id', user.id);

    const bucketMap = new Map<string, { count: number; size: number }>();
    for (const file of bucketData || []) {
      const existing = bucketMap.get(file.bucket) || { count: 0, size: 0 };
      bucketMap.set(file.bucket, {
        count: existing.count + 1,
        size: existing.size + file.size,
      });
    }

    const buckets = Array.from(bucketMap.entries()).map(([name, info]) => ({
      name,
      file_count: info.count,
      total_size: info.size,
    }));

    return NextResponse.json({ files, buckets, total: count });
  } catch (error) {
    console.error('List files error:', error);
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
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

    const { fileId, key, bucket, metadata } = await request.json();

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    // Get current file
    const { data: currentFile, error: fetchError } = await supabaseAdmin
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !currentFile) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Build updates
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const newKey = key || currentFile.key;
    const newBucket = bucket || currentFile.bucket;

    if (key) updates.key = key;
    if (bucket) updates.bucket = bucket;
    if (metadata) updates.metadata = metadata;
    if (key) updates.file_name = key.split('/').pop() || key;

    // Update Telegram caption if key or bucket changed
    if (key || bucket) {
      // Get user's Telegram credentials
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('telegram_bot_token, telegram_chat_id')
        .eq('id', user.id)
        .single();

      const botToken = userData?.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;
      const chatId = currentFile.telegram_chat_id;

      if (botToken) {
        try {
          const telegram = new TelegramClient(botToken, chatId);
          const newCaption = `TeleCloud:${newBucket}:${newKey}`;
          
          // Edit message caption
          await fetch(`https://api.telegram.org/bot${botToken}/editMessageCaption`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: currentFile.telegram_message_id,
              caption: newCaption,
            }),
          });
        } catch (telegramError) {
          console.error('Failed to update Telegram caption:', telegramError);
          // Continue even if Telegram update fails
        }
      }
    }

    // Update database
    const { data: updatedFile, error: updateError } = await supabaseAdmin
      .from('files')
      .update(updates)
      .eq('id', fileId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update file' }, { status: 500 });
    }

    return NextResponse.json({ file: updatedFile, success: true });
  } catch (error) {
    console.error('Update file error:', error);
    return NextResponse.json({ error: 'Failed to update file' }, { status: 500 });
  }
}

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

    const { fileId, bucket, key } = await request.json();

    // Delete by ID or by bucket/key
    if (fileId) {
      const { data: file } = await supabaseAdmin
        .from('files')
        .select('*')
        .eq('id', fileId)
        .eq('user_id', user.id)
        .single();

      if (!file) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }

      // Delete from Telegram
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('telegram_bot_token')
        .eq('id', user.id)
        .single();

      const botToken = userData?.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;
      
      if (botToken) {
        try {
          const telegram = new TelegramClient(botToken, file.telegram_chat_id);
          await telegram.deleteMessage(file.telegram_message_id);
        } catch (e) {
          console.error('Failed to delete from Telegram:', e);
        }
      }

      // Update storage
      const { data: currentUser } = await supabaseAdmin
        .from('users')
        .select('storage_used')
        .eq('id', user.id)
        .single();

      if (currentUser) {
        await supabaseAdmin
          .from('users')
          .update({ storage_used: Math.max(0, currentUser.storage_used - file.size) })
          .eq('id', user.id);
      }

      // Delete from database
      await supabaseAdmin.from('files').delete().eq('id', fileId);

      return NextResponse.json({ success: true });
    }

    if (bucket && key) {
      const { data: file } = await supabaseAdmin
        .from('files')
        .select('*')
        .eq('user_id', user.id)
        .eq('bucket', bucket)
        .eq('key', key)
        .single();

      if (!file) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }

      // Delete from Telegram
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('telegram_bot_token')
        .eq('id', user.id)
        .single();

      const botToken = userData?.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;
      
      if (botToken) {
        try {
          const telegram = new TelegramClient(botToken, file.telegram_chat_id);
          await telegram.deleteMessage(file.telegram_message_id);
        } catch (e) {
          console.error('Failed to delete from Telegram:', e);
        }
      }

      // Update storage
      const { data: currentUser } = await supabaseAdmin
        .from('users')
        .select('storage_used')
        .eq('id', user.id)
        .single();

      if (currentUser) {
        await supabaseAdmin
          .from('users')
          .update({ storage_used: Math.max(0, currentUser.storage_used - file.size) })
          .eq('id', user.id);
      }

      // Delete from database
      await supabaseAdmin.from('files').delete().eq('id', file.id);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'File ID or bucket/key required' }, { status: 400 });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
