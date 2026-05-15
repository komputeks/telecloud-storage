import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { CaptionSyncService, CaptionBuilder, MetadataChangeTracker } from '@/lib/sync/caption-sync';
import { TelegramClient } from '@/lib/telegram';

// GET - Retrieve file metadata
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
    const fileId = searchParams.get('fileId');
    const bucket = searchParams.get('bucket');
    const key = searchParams.get('key');

    let query = supabaseAdmin
      .from('files')
      .select('*')
      .eq('user_id', user.id);

    if (fileId) {
      query = query.eq('id', fileId);
    } else if (bucket && key) {
      query = query.eq('bucket', bucket).eq('key', key);
    } else {
      return NextResponse.json({ error: 'FileId or bucket+key required' }, { status: 400 });
    }

    const { data: file, error } = await query.single();

    if (error || !file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Parse caption if available
    let parsedCaption = null;
    if (file.telegram_message_id) {
      // Caption is stored in the file record, but we can also fetch from Telegram
      // For now, return the stored metadata
      parsedCaption = {
        bucket: file.bucket,
        key: file.key,
        fileName: file.file_name,
        mimeType: file.mime_type,
        size: file.size,
        tags: file.tags || [],
        custom: file.custom_metadata || {},
      };
    }

    return NextResponse.json({
      file: {
        ...file,
        parsedCaption,
        captionVersion: file.caption_version || 1,
        captionSyncedAt: file.caption_synced_at,
      },
    });
  } catch (error) {
    console.error('Get metadata error:', error);
    return NextResponse.json({ error: 'Failed to get metadata' }, { status: 500 });
  }
}

// PUT - Update file metadata and sync to Telegram
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
    const { fileId, bucket, key, updates, syncToTelegram = true } = body;

    if (!fileId && (!bucket || !key)) {
      return NextResponse.json({ error: 'FileId or bucket+key required' }, { status: 400 });
    }

    // Get current file data
    let query = supabaseAdmin
      .from('files')
      .select('*')
      .eq('user_id', user.id);

    if (fileId) {
      query = query.eq('id', fileId);
    } else {
      query = query.eq('bucket', bucket).eq('key', key);
    }

    const { data: currentFile, error: fetchError } = await query.single();

    if (fetchError || !currentFile) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Record the change
    await MetadataChangeTracker.recordChange(
      currentFile.id,
      'update',
      {
        bucket: currentFile.bucket,
        key: currentFile.key,
        file_name: currentFile.file_name,
        tags: currentFile.tags,
        custom_metadata: currentFile.custom_metadata,
      },
      updates
    );

    // Build update object
    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.bucket !== undefined) dbUpdates.bucket = updates.bucket;
    if (updates.key !== undefined) dbUpdates.key = updates.key;
    if (updates.file_name !== undefined) dbUpdates.file_name = updates.file_name;
    if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
    if (updates.custom_metadata !== undefined) dbUpdates.custom_metadata = updates.custom_metadata;

    // Update database
    const { data: updatedFile, error: updateError } = await supabaseAdmin
      .from('files')
      .update(dbUpdates)
      .eq('id', currentFile.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update metadata' }, { status: 500 });
    }

    // Sync to Telegram if requested
    let syncResult = null;
    if (syncToTelegram && currentFile.telegram_message_id) {
      // Get user's Telegram credentials
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('telegram_bot_token, telegram_chat_id')
        .eq('id', user.id)
        .single();

      const botToken = userData?.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;
      const chatId = userData?.telegram_chat_id || process.env.TELEGRAM_CHAT_ID;

      if (botToken && chatId) {
        const telegram = new TelegramClient(botToken, chatId);
        
        syncResult = await CaptionSyncService.syncToTelegram(
          telegram,
          currentFile.telegram_chat_id,
          currentFile.telegram_message_id,
          updatedFile,
          updates.custom_metadata
        );
      }
    }

    return NextResponse.json({
      success: true,
      file: updatedFile,
      sync: syncResult,
    });
  } catch (error) {
    console.error('Update metadata error:', error);
    return NextResponse.json({ error: 'Failed to update metadata' }, { status: 500 });
  }
}

// POST - Batch update metadata
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
    const { fileIds, updates, syncToTelegram = true } = body;

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json({ error: 'FileIds array required' }, { status: 400 });
    }

    // Get files
    const { data: files, error: fetchError } = await supabaseAdmin
      .from('files')
      .select('*')
      .eq('user_id', user.id)
      .in('id', fileIds);

    if (fetchError || !files || files.length === 0) {
      return NextResponse.json({ error: 'No files found' }, { status: 404 });
    }

    // Build update object
    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
    if (updates.custom_metadata !== undefined) dbUpdates.custom_metadata = updates.custom_metadata;

    // Update all files
    const { error: updateError } = await supabaseAdmin
      .from('files')
      .update(dbUpdates)
      .in('id', fileIds);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update files' }, { status: 500 });
    }

    // Batch sync to Telegram if requested
    let syncResult = null;
    if (syncToTelegram && files.some(f => f.telegram_message_id)) {
      // Get user's Telegram credentials
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('telegram_bot_token, telegram_chat_id')
        .eq('id', user.id)
        .single();

      const botToken = userData?.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;
      const chatId = userData?.telegram_chat_id || process.env.TELEGRAM_CHAT_ID;

      if (botToken && chatId) {
        const telegram = new TelegramClient(botToken, chatId);

        syncResult = await CaptionSyncService.batchSync(
          files.map(f => ({
            id: f.id,
            telegram_message_id: f.telegram_message_id,
            telegram_chat_id: f.telegram_chat_id,
            metadata: { ...f, ...dbUpdates },
          })),
          async () => telegram
        );
      }
    }

    return NextResponse.json({
      success: true,
      updatedCount: files.length,
      sync: syncResult,
    });
  } catch (error) {
    console.error('Batch update error:', error);
    return NextResponse.json({ error: 'Failed to batch update' }, { status: 500 });
  }
}
