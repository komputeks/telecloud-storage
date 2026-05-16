import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { CaptionBuilder } from '@/lib/sync/caption-sync';
import { TelegramClient } from '@/lib/telegram';
import { v4 as uuidv4 } from 'uuid';

/**
 * Copy file - Create a copy with optional new bucket/key
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
      copyMetadata = true 
    } = body;

    // Validate inputs
    if (!destBucket || !destKey) {
      return NextResponse.json({ error: 'Destination bucket and key required' }, { status: 400 });
    }

    // Get source file
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

    const { data: sourceFile, error: fetchError } = await query.single();

    if (fetchError || !sourceFile) {
      return NextResponse.json({ error: 'Source file not found' }, { status: 404 });
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

    // Check storage quota
    const { data: userData } = await supabaseAdmin
      .from('telecloud_users')
      .select('storage_used, storage_limit')
      .eq('id', user.id)
      .single();

    if (userData && userData.storage_limit > 0 && userData.storage_used + sourceFile.size > userData.storage_limit) {
      return NextResponse.json({ error: 'Storage quota exceeded. Upgrade for unlimited storage.' }, { status: 400 });
    }

    // Get Telegram client
    const { data: userTelegram } = await supabaseAdmin
      .from('telecloud_users')
      .select('telegram_bot_token, telegram_chat_id')
      .eq('id', user.id)
      .single();

    const botToken = userTelegram?.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = userTelegram?.telegram_chat_id || process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      return NextResponse.json({ error: 'Telegram not configured' }, { status: 400 });
    }

    const telegram = new TelegramClient(botToken, chatId);

    // Download file from Telegram
    const fileData = await telegram.downloadFile(sourceFile.telegram_file_id);

    // Build caption for the copy
    const newFileMetadata = {
      bucket: destBucket,
      key: destKey,
      file_name: destKey.split('/').pop() || destKey,
      mime_type: sourceFile.mime_type,
      size: sourceFile.size,
      created_at: new Date().toISOString(),
      tags: copyMetadata ? sourceFile.tags : [],
      custom_metadata: copyMetadata ? sourceFile.custom_metadata : {},
    };

    const caption = CaptionBuilder.build(newFileMetadata);

    // Re-upload to Telegram (creates new file)
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('document', new Blob([fileData.data], { type: sourceFile.mime_type }), destKey.split('/').pop() || destKey);
    formData.append('caption', caption);

    const uploadUrl = `https://api.telegram.org/bot${botToken}/sendDocument`;
    const uploadResponse = await fetch(uploadUrl, { method: 'POST', body: formData });
    const uploadData = await uploadResponse.json();

    if (!uploadData.ok) {
      return NextResponse.json({ error: uploadData.description || 'Failed to copy file' }, { status: 500 });
    }

    const message = uploadData.result;
    const document = message.document || message.video || message.photo?.[message.photo.length - 1];

    // Create database entry for the copy
    const newFileId = uuidv4();
    const { data: newFile, error: insertError } = await supabaseAdmin
      .from('telecloud_files')
      .insert({
        id: newFileId,
        user_id: user.id,
        bucket: destBucket,
        key: destKey,
        file_name: destKey.split('/').pop() || destKey,
        mime_type: sourceFile.mime_type,
        size: sourceFile.size,
        telegram_file_id: document.file_id,
        telegram_message_id: message.message_id,
        telegram_chat_id: chatId,
        tags: copyMetadata ? sourceFile.tags : [],
        custom_metadata: copyMetadata ? sourceFile.custom_metadata : {},
        caption_version: 2,
        caption_synced_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      // Clean up Telegram message
      await telegram.deleteMessage(message.message_id);
      return NextResponse.json({ error: 'Failed to create file copy' }, { status: 500 });
    }

    // Update user storage
    await supabaseAdmin
      .from('telecloud_users')
      .update({ storage_used: (userData?.storage_used || 0) + sourceFile.size })
      .eq('id', user.id);

    return NextResponse.json({
      success: true,
      sourceFile: {
        id: sourceFile.id,
        path: `${sourceFile.bucket}/${sourceFile.key}`,
      },
      copy: newFile,
    });
  } catch (error) {
    console.error('Copy file error:', error);
    return NextResponse.json({ error: 'Failed to copy file' }, { status: 500 });
  }
}
