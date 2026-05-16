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
  ): Promise<{ client: TelegramClient; chatId: string; isUserbot: boolean } | null> {
    try {
      const { data: user } = await supabaseAdmin
        .from('telecloud_users')
        .select('telegram_bot_token, telegram_chat_id, telegram_api_id, telegram_api_hash, telegram_phone, telegram_use_userbot')
        .eq('id', userId)
        .single();

      // 1) Try user's own bot first — BOTH token AND chat_id must be non-empty strings
      if (user?.telegram_bot_token && user.telegram_bot_token.trim() && user?.telegram_chat_id && user.telegram_chat_id.trim()) {
        console.log(`[storage] Using user's own bot for user ${userId}`);
        return {
          client: new TelegramClient(user.telegram_bot_token.trim(), user.telegram_chat_id.trim()),
          chatId: user.telegram_chat_id.trim(),
          isUserbot: false,
        };
      }

      // 2) Try global bot — first from env, then from DB settings
      let globalToken = process.env.TELEGRAM_BOT_TOKEN || '';
      let globalChatId = process.env.TELEGRAM_CHAT_ID || '';

      // Always check DB settings as fallback/override
      try {
        const { data: settings, error: settingsErr } = await supabaseAdmin
          .from('settings')
          .select('key, value')
          .in('key', ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']);
        
        if (settingsErr) {
          console.error('[storage] Failed to fetch settings:', settingsErr.message);
        } else if (settings && settings.length > 0) {
          for (const s of settings) {
            if (s.key === 'TELEGRAM_BOT_TOKEN' && s.value && s.value.trim()) {
              globalToken = s.value.trim();
            }
            if (s.key === 'TELEGRAM_CHAT_ID' && s.value && s.value.trim()) {
              globalChatId = s.value.trim();
            }
          }
        }
      } catch (e) {
        console.error('[storage] Exception fetching global bot settings:', e);
      }

      if (globalToken && globalChatId) {
        console.log(`[storage] Using global bot for user ${userId}`);
        return {
          client: new TelegramClient(globalToken, globalChatId),
          chatId: globalChatId,
          isUserbot: false,
        };
      }

      // 3) Last resort: if user has a chat_id but no bot token, use global token with user's chat_id
      if (user?.telegram_chat_id && user.telegram_chat_id.trim() && globalToken) {
        console.log(`[storage] Using global bot token with user's chat_id for user ${userId}`);
        return {
          client: new TelegramClient(globalToken, user.telegram_chat_id.trim()),
          chatId: user.telegram_chat_id.trim(),
          isUserbot: false,
        };
      }

      console.error(`[storage] No Telegram config found for user ${userId}. globalToken=${!!globalToken}, globalChatId=${!!globalChatId}, userToken=${!!user?.telegram_bot_token}, userChatId=${!!user?.telegram_chat_id}`);
      return null;
    } catch (error) {
      console.error('[storage] getTelegramClient error:', error);
      return null;
    }
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
          error: `File too large (${(fileSize / 1024 / 1024).toFixed(1)}MB). Maximum file size is 50MB.`,
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

      // storage_limit === 0 means unlimited (upgraded users with own bot)
      if (userData && userData.storage_limit > 0 && userData.storage_used + fileSize > userData.storage_limit) {
        return { success: false, error: 'Storage quota exceeded. Upgrade your account for unlimited storage.' };
      }

      const detectedMime = mimeType || mime.lookup(key) || 'application/octet-stream';
      const isImage = detectedMime.startsWith('image/');
      const isVideo = detectedMime.startsWith('video/');

      // Get username for caption
      const { data: userInfo } = await supabaseAdmin
        .from('telecloud_users')
        .select('name, email')
        .eq('id', userId)
        .single();
      const username = userInfo?.name || userInfo?.email?.split('@')[0] || 'User';

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
      const caption = CaptionBuilder.build(fileMetadata, customMetadata, username);

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

      const telegramConfig = await this.getTelegramClient(userId);
      if (telegramConfig) {
        try { await telegramConfig.client.deleteMessage(file.telegram_message_id); } catch { /* ignore */ }
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
   * Files >50MB are rejected.
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
      const contentType = response.headers.get('content-type') || undefined;

      return this.uploadFile(userId, bucket, key, arrayBuffer, contentType, metadata, tags, customMetadata);
    } catch (error) {
      console.error('URL upload error:', error);
      return { success: false, error: 'Failed to upload from URL' };
    }
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
