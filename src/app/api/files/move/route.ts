import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { CaptionSyncService, MetadataChangeTracker } from '@/lib/sync/caption-sync';
import { TelegramClient } from '@/lib/telegram';

/**
 * Move file - Change bucket and/or key with Telegram caption sync
 */
export async function POST(request: NextRequest) {
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
    const { 
      fileId, 
      sourceBucket, 
      sourceKey,
      destBucket, 
      destKey,
      syncToTelegram = true 
    } = body;

    // Validate inputs
    if (!destBucket || !destKey) {
      return NextResponse.json({ error: 'Destination bucket and key required' }, { status: 400 });
    }

    // Get file
    let query = supabaseAdmin
      .from('telecloud_files')
      .select('*')
      .eq('user_id', user.id);

    if (fileId) {
      query = query.eq('id', fileId);
    } else if (sourceBucket && sourceKey) {
      query = query.eq('bucket', sourceBucket).eq('key', sourceKey);
    } else {
      return NextResponse.json({ error: 'FileId or source bucket+key required' }, { status: 400 });
    }

    const { data: file, error: fetchError } = await query.single();

    if (fetchError || !file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Check if destination already exists
    const { data: existingFile } = await supabaseAdmin
      .from('telecloud_files')
      .select('id')
      .eq('user_id', user.id)
      .eq('bucket', destBucket)
      .eq('key', destKey)
      .single();

    if (existingFile) {
      return NextResponse.json({ 
        error: 'A file with this destination path already exists',
        existingFileId: existingFile.id 
      }, { status: 409 });
    }

    // Record the change
    await MetadataChangeTracker.recordChange(
      file.id,
      'move',
      { bucket: file.bucket, key: file.key },
      { bucket: destBucket, key: destKey }
    );

    // Update database
    const { data: updatedFile, error: updateError } = await supabaseAdmin
      .from('telecloud_files')
      .update({
        bucket: destBucket,
        key: destKey,
        file_name: destKey.split('/').pop() || destKey,
        updated_at: new Date().toISOString(),
      })
      .eq('id', file.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Failed to move file' }, { status: 500 });
    }

    // Sync caption to Telegram
    let syncResult = null;
    if (syncToTelegram && file.telegram_message_id) {
      const { data: userData } = await supabaseAdmin
        .from('telecloud_users')
        .select('telegram_bot_token, telegram_chat_id')
        .eq('id', user.id)
        .single();

      const botToken = userData?.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;
      const chatId = userData?.telegram_chat_id || process.env.TELEGRAM_CHAT_ID;

      if (botToken && chatId) {
        const telegram = new TelegramClient(botToken, chatId);
        
        syncResult = await CaptionSyncService.syncToTelegram(
          telegram,
          file.telegram_chat_id,
          file.telegram_message_id,
          updatedFile
        );
      }
    }

    return NextResponse.json({
      success: true,
      file: updatedFile,
      previousPath: `${file.bucket}/${file.key}`,
      newPath: `${destBucket}/${destKey}`,
      sync: syncResult,
    });
  } catch (error) {
    console.error('Move file error:', error);
    return NextResponse.json({ error: 'Failed to move file' }, { status: 500 });
  }
}
