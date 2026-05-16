import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';
import { supabaseAdmin } from './supabase';
import { TelegramClient } from './telegram';
import { CaptionBuilder, CaptionSyncService } from './sync/caption-sync';

export interface StoredFile {
  id: string;
  user_id: string;
  bucket: string;
  key: string;
  file_name: string;
  mime_type: string;
  size: number;
  telegram_file_id: string;
  telegram_message_id: number;
  telegram_chat_id: string;
  tags: string[];
  custom_metadata: Record<string, unknown>;
  caption_version: number;
  caption_synced_at: string;
  metadata: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface UploadResult {
  success: boolean;
  file?: StoredFile;
  error?: string;
}

export interface BucketInfo {
  name: string;
  file_count: number;
  total_size: number;
  created_at: string;
}

// File size limit — Telegram Bot API max
const BOT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export class StorageService {
  /**
   * Get Telegram bot client for a user.
   * Priority: user's own bot → global bot (env vars → DB settings)
   */
  private async getTelegramClient(
    userId: string
  ): Promise<{ client: TelegramClient; chatId: string } | null> {
    // 1) Try user's own bot
    const { data: user } = await supabaseAdmin
      .from('telecloud_users')
      .select('telegram_bot_token, telegram_chat_id')
      .eq('id', userId)
      .single();

    if (user?.telegram_bot_token && user?.telegram_chat_id) {
      return {
        client: new TelegramClient(user.telegram_bot_token, user.telegram_chat_id),
        chatId: user.telegram_chat_id,
      };
    }

    // 2) Try global bot from environment
    let globalToken = process.env.TELEGRAM_BOT_TOKEN || '';
    let globalChatId = process.env.TELEGRAM_CHAT_ID || '';

    // 3) Fallback to database settings (admin panel)
    try {
      const { data: settings } = await supabaseAdmin
        .from('settings')
        .select('key, value')
        .in('key', ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']);

      const settingsMap = new Map(settings?.map(s => [s.key, s.value]) || []);
      if (!globalToken) globalToken = settingsMap.get('TELEGRAM_BOT_TOKEN') || '';
      if (!globalChatId) globalChatId = settingsMap.get('TELEGRAM_CHAT_ID') || '';
    } catch (e) {
      console.error('Failed to fetch global bot settings:', e);
    }

    if (globalToken && globalChatId) {
      return {
        client: new TelegramClient(globalToken, globalChatId),
        chatId: globalChatId,
      };
    }

    return null;
  }

  /**
   * Upload file via Telegram Bot API (max 50MB)
   */
  async uploadFile(
    userId: string,
    bucket: string,
    key: string,
    fileData: ArrayBuffer,
    mimeType?: string,
    metadata?: Record<string, string>,
    tags?: string[],
    customMetadata?: Record<string, unknown>
  ): Promise<UploadResult> {
    try {
      const fileSize = fileData.byteLength;

      if (fileSize > BOT_MAX_FILE_SIZE) {
        return {
          success: false,
          error: 'USE_CHUNKED_UPLOAD',
        };
      }

      const telegramConfig = await this.getTelegramClient(userId);
      if (!telegramConfig) {
        console.error('No telegram config found for user:', userId);
        return {
          success: false,
          error: 'No Telegram bot configured. Please set up your Telegram bot in Settings, or contact admin to configure global bot.',
        };
      }

      const { client: telegram, chatId } = telegramConfig;

      const { data: userData } = await supabaseAdmin
        .from('telecloud_users')
        .select('storage_used, storage_limit')
        .eq('id', userId)
        .single();

      if (userData && userData.storage_used + fileSize > userData.storage_limit) {
        return { success: false, error: 'Storage quota exceeded' };
      }

      const detectedMime = mimeType || mime.lookup(key) || 'application/octet-stream';
      const isImage = detectedMime.startsWith('image/');
      const isVideo = detectedMime.startsWith('video/');

      const fileMetadata = {
        bucket,
        key,
        file_name: key.split('/').pop() || key,
        mime_type: detectedMime,
        size: fileSize,
        created_at: new Date().toISOString(),
        tags: tags || [],
        custom_metadata: customMetadata || {},
      };
      const caption = CaptionBuilder.build(fileMetadata);

      let message;
      try {
        if (isImage && fileSize < 10 * 1024 * 1024) {
          message = await telegram.sendPhoto(fileData, key, caption);
        } else if (isVideo && fileSize < 50 * 1024 * 1024) {
          message = await telegram.sendVideo(fileData, key, caption);
        } else {
          message = await telegram.sendDocument(fileData, key, detectedMime, caption);
        }
      } catch (telegramError) {
        console.error('Telegram upload failed:', telegramError);
        return {
          success: false,
          error: `Telegram upload failed: ${telegramError instanceof Error ? telegramError.message : 'Unknown error'}`,
        };
      }

      const document = message.document || message.video || message.photo?.[message.photo.length - 1];
      if (!document) {
        return { success: false, error: 'Failed to get file info from Telegram' };
      }

      const fileId = uuidv4();
      const now = new Date().toISOString();
      const { data: storedFile, error } = await supabaseAdmin
        .from('telecloud_files')
        .insert({
          id: fileId,
          user_id: userId,
          bucket,
          key,
          file_name: key.split('/').pop() || key,
          mime_type: detectedMime,
          size: fileSize,
          telegram_file_id: document.file_id,
          telegram_message_id: message.message_id,
          telegram_chat_id: chatId,
          tags: tags || [],
          custom_metadata: customMetadata || {},
          metadata: metadata || {},
          caption_version: 2,
          caption_synced_at: now,
        })
        .select()
        .single();

      if (error) {
        await telegram.deleteMessage(message.message_id);
        return { success: false, error: 'Failed to store file metadata' };
      }

      // Update user storage
      if (userData) {
        await supabaseAdmin
          .from('telecloud_users')
          .update({ storage_used: userData.storage_used + fileSize })
          .eq('id', userId);
      }

      return { success: true, file: storedFile };
    } catch (error) {
      console.error('Upload error:', error);
      return { success: false, error: 'Upload failed' };
    }
  }

  /**
   * Download file
   */
  async downloadFile(userId: string, bucket: string, key: string): Promise<ArrayBuffer | null> {
    try {
      const { data: file } = await supabaseAdmin
        .from('telecloud_files')
        .select('*')
        .eq('user_id', userId)
        .eq('bucket', bucket)
        .eq('key', key)
        .single();

      if (!file) return null;

      const telegramConfig = await this.getTelegramClient(userId);
      if (!telegramConfig) return null;

      const { client: telegram } = telegramConfig;
      const { data } = await telegram.downloadFile(file.telegram_file_id);
      return data;
    } catch (error) {
      console.error('Download error:', error);
      return null;
    }
  }

  /**
   * Get file info
   */
  async getFileInfo(userId: string, bucket: string, key: string): Promise<StoredFile | null> {
    const { data: file } = await supabaseAdmin
      .from('telecloud_files')
      .select('*')
      .eq('user_id', userId)
      .eq('bucket', bucket)
      .eq('key', key)
      .single();

    return file;
  }

  /**
   * Get file URL
   */
  async getFileUrl(userId: string, bucket: string, key: string): Promise<string | null> {
    try {
      const { data: file } = await supabaseAdmin
        .from('telecloud_files')
        .select('*')
        .eq('user_id', userId)
        .eq('bucket', bucket)
        .eq('key', key)
        .single();

      if (!file) return null;

      const telegramConfig = await this.getTelegramClient(userId);
      if (!telegramConfig) return null;

      const { client: telegram } = telegramConfig;
      return await telegram.getFileUrl(file.telegram_file_id);
    } catch {
      return null;
    }
  }

  /**
   * Delete file
   */
  async deleteFile(userId: string, bucket: string, key: string): Promise<boolean> {
    try {
      const { data: file } = await supabaseAdmin
        .from('telecloud_files')
        .select('*')
        .eq('user_id', userId)
        .eq('bucket', bucket)
        .eq('key', key)
        .single();

      if (!file) return false;

      if (this.isChunkedFile(file)) {
        await this.deleteChunkedFile(userId, file.id);
      } else {
        const telegramConfig = await this.getTelegramClient(userId);
        if (telegramConfig) {
          try { await telegramConfig.client.deleteMessage(file.telegram_message_id); } catch { /* ignore */ }
        }
      }

      await supabaseAdmin.from('telecloud_files').delete().eq('id', file.id);

      const { data: currentUser } = await supabaseAdmin
        .from('telecloud_users')
        .select('storage_used')
        .eq('id', userId)
        .single();

      if (currentUser) {
        await supabaseAdmin
          .from('telecloud_users')
          .update({ storage_used: Math.max(0, currentUser.storage_used - file.size) })
          .eq('id', userId);
      }

      return true;
    } catch (error) {
      console.error('Delete error:', error);
      return false;
    }
  }

  /**
   * List files in bucket
   */
  async listFiles(
    userId: string,
    bucket: string,
    prefix?: string,
    limit = 100,
    offset = 0
  ): Promise<StoredFile[]> {
    let query = supabaseAdmin
      .from('telecloud_files')
      .select('*')
      .eq('user_id', userId)
      .eq('bucket', bucket)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (prefix) {
      query = query.like('key', `${prefix}%`);
    }

    const { data } = await query;
    return data || [];
  }

  /**
   * List buckets
   */
  async listBuckets(userId: string): Promise<BucketInfo[]> {
    const { data } = await supabaseAdmin
      .from('telecloud_files')
      .select('bucket, size')
      .eq('user_id', userId);

    if (!data) return [];

    const bucketMap = new Map<string, { count: number; size: number }>();

    for (const file of data) {
      const existing = bucketMap.get(file.bucket) || { count: 0, size: 0 };
      bucketMap.set(file.bucket, {
        count: existing.count + 1,
        size: existing.size + file.size,
      });
    }

    return Array.from(bucketMap.entries()).map(([name, info]) => ({
      name,
      file_count: info.count,
      total_size: info.size,
      created_at: new Date().toISOString(),
    }));
  }

  /**
   * Upload from URL — fetches URL then uploads via bot API.
   * Files >50MB are automatically chunked.
   */
  async uploadFromUrl(
    userId: string,
    bucket: string,
    key: string,
    url: string,
    metadata?: Record<string, string>,
    tags?: string[],
    customMetadata?: Record<string, unknown>
  ): Promise<UploadResult> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return { success: false, error: 'Failed to fetch URL' };
      }

      const arrayBuffer = await response.arrayBuffer();
      const actualSize = arrayBuffer.byteLength;
      const contentType = response.headers.get('content-type') || undefined;

      // If file is >50MB, use chunked upload automatically
      if (actualSize > BOT_MAX_FILE_SIZE) {
        return this.uploadFromUrlChunked(userId, bucket, key, arrayBuffer, contentType, metadata, tags, customMetadata);
      }

      return this.uploadFile(userId, bucket, key, arrayBuffer, contentType, metadata, tags, customMetadata);
    } catch (error) {
      console.error('URL upload error:', error);
      return { success: false, error: 'Failed to upload from URL' };
    }
  }

  /**
   * Chunked upload for large files fetched from URL
   */
  private async uploadFromUrlChunked(
    userId: string,
    bucket: string,
    key: string,
    fileData: ArrayBuffer,
    mimeType?: string,
    metadata?: Record<string, string>,
    tags?: string[],
    customMetadata?: Record<string, unknown>
  ): Promise<UploadResult> {
    try {
      const fileSize = fileData.byteLength;
      const chunkSize = 49 * 1024 * 1024; // 49MB per chunk
      const totalChunks = Math.ceil(fileSize / chunkSize);
      const detectedMime = mimeType || mime.lookup(key) || 'application/octet-stream';
      const fileName = key.split('/').pop() || key;

      const { data: userData } = await supabaseAdmin
        .from('telecloud_users')
        .select('storage_used, storage_limit')
        .eq('id', userId)
        .single();
      if (userData && userData.storage_used + fileSize > userData.storage_limit) {
        return { success: false, error: 'Storage quota exceeded' };
      }

      const fileId = uuidv4();
      const { error: insertErr } = await supabaseAdmin.from('telecloud_files').insert({
        id: fileId, user_id: userId, bucket, key,
        file_name: fileName,
        mime_type: detectedMime, size: fileSize,
        telegram_file_id: `chunked:${totalChunks}`,
        telegram_message_id: 0, telegram_chat_id: 'chunked',
        tags: tags || [], custom_metadata: { ...(customMetadata || {}), is_chunked: true, total_chunks: totalChunks },
        metadata: metadata || {}, caption_version: 2, caption_synced_at: new Date().toISOString(),
      });
      if (insertErr) {
        return { success: false, error: 'Failed to initialize chunked upload' };
      }

      const uint8 = new Uint8Array(fileData);
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, fileSize);
        const chunkData = uint8.slice(start, end).buffer;

        const result = await this.uploadChunk(userId, bucket, fileId, i, totalChunks, chunkData, fileName);
        if (!result.success) {
          await supabaseAdmin.from('telecloud_file_chunks').delete().eq('file_id', fileId);
          await supabaseAdmin.from('telecloud_files').delete().eq('id', fileId);
          return { success: false, error: `Chunk ${i + 1}/${totalChunks} failed: ${result.error}` };
        }
      }

      if (userData) {
        await supabaseAdmin.from('telecloud_users')
          .update({ storage_used: userData.storage_used + fileSize })
          .eq('id', userId);
      }

      const { data: storedFile } = await supabaseAdmin
        .from('telecloud_files').select('*').eq('id', fileId).single();

      return { success: true, file: storedFile };
    } catch (error) {
      console.error('Chunked URL upload error:', error);
      return { success: false, error: 'Chunked upload from URL failed' };
    }
  }

  /**
   * Upload a single chunk to Telegram and record it in telecloud_file_chunks.
   */
  async uploadChunk(
    userId: string,
    bucket: string,
    fileId: string,
    chunkIndex: number,
    totalChunks: number,
    chunkData: ArrayBuffer,
    originalFileName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const telegramConfig = await this.getTelegramClient(userId);
      if (!telegramConfig) {
        return { success: false, error: 'No Telegram bot configured. Set up in Settings.' };
      }
      const { client: telegram, chatId } = telegramConfig;
      const chunkName = `${originalFileName}.part${String(chunkIndex).padStart(4, '0')}of${totalChunks}`;
      const caption = `\ud83d\udce6 Chunk ${chunkIndex + 1}/${totalChunks} of "${originalFileName}"`;
      const message = await telegram.sendDocument(chunkData, chunkName, 'application/octet-stream', caption);
      const document = message.document;
      if (!document) return { success: false, error: 'Telegram did not return file info for chunk' };
      const { error } = await supabaseAdmin.from('telecloud_file_chunks').insert({
        file_id: fileId,
        chunk_index: chunkIndex,
        total_chunks: totalChunks,
        chunk_size: chunkData.byteLength,
        telegram_file_id: document.file_id,
        telegram_message_id: message.message_id,
        telegram_chat_id: chatId,
      });
      if (error) {
        try { await telegram.deleteMessage(message.message_id); } catch { /* ignore */ }
        return { success: false, error: `DB error: ${error.message}` };
      }
      return { success: true };
    } catch (error) {
      console.error(`Chunk ${chunkIndex} upload error:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Chunk upload failed' };
    }
  }

  /** Check if a file is chunked */
  isChunkedFile(file: StoredFile): boolean {
    return file.telegram_file_id?.startsWith('chunked:') || (file.custom_metadata as Record<string, unknown>)?.is_chunked === true;
  }

  /** Download a chunked file by fetching all chunks from Telegram and streaming. */
  async downloadChunkedFile(userId: string, fileId: string): Promise<{ stream: ReadableStream<Uint8Array>; size: number } | null> {
    try {
      const { data: chunks } = await supabaseAdmin
        .from('telecloud_file_chunks').select('*').eq('file_id', fileId).order('chunk_index', { ascending: true });
      if (!chunks || chunks.length === 0) return null;
      const telegramConfig = await this.getTelegramClient(userId);
      if (!telegramConfig) return null;
      const { client: telegram } = telegramConfig;
      const totalSize = chunks.reduce((sum: number, c: { chunk_size: number }) => sum + Number(c.chunk_size), 0);
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for (const chunk of chunks) {
              const { data } = await telegram.downloadFile(chunk.telegram_file_id);
              controller.enqueue(new Uint8Array(data));
            }
            controller.close();
          } catch (err) { controller.error(err); }
        },
      });
      return { stream, size: totalSize };
    } catch (error) { console.error('Chunked download error:', error); return null; }
  }

  /** Delete a chunked file (all Telegram messages + DB records) */
  async deleteChunkedFile(userId: string, fileId: string): Promise<boolean> {
    try {
      const { data: chunks } = await supabaseAdmin
        .from('telecloud_file_chunks').select('telegram_message_id').eq('file_id', fileId);
      if (chunks && chunks.length > 0) {
        const telegramConfig = await this.getTelegramClient(userId);
        if (telegramConfig) {
          for (const chunk of chunks) {
            try { await telegramConfig.client.deleteMessage(chunk.telegram_message_id); } catch { /* ignore */ }
          }
        }
      }
      await supabaseAdmin.from('telecloud_file_chunks').delete().eq('file_id', fileId);
      return true;
    } catch (error) { console.error('Delete chunked file error:', error); return false; }
  }

  /**
   * Sync all file captions (admin/maintenance)
   */
  async syncAllCaptions(userId: string): Promise<{ total: number; synced: number; failed: number }> {
    const { data: files } = await supabaseAdmin
      .from('telecloud_files')
      .select('*')
      .eq('user_id', userId);

    if (!files || files.length === 0) {
      return { total: 0, synced: 0, failed: 0 };
    }

    const telegramConfig = await this.getTelegramClient(userId);
    if (!telegramConfig) {
      return { total: files.length, synced: 0, failed: files.length };
    }

    const result = await CaptionSyncService.batchSync(
      files.map(f => ({
        id: f.id,
        telegram_message_id: f.telegram_message_id,
        telegram_chat_id: f.telegram_chat_id,
        metadata: f,
      })),
      async () => telegramConfig.client
    );

    return {
      total: result.total,
      synced: result.synced,
      failed: result.failed,
    };
  }
}

export const storageService = new StorageService();
export default StorageService;
