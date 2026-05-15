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
  needsUserbot?: boolean;
}

export interface BucketInfo {
  name: string;
  file_count: number;
  total_size: number;
  created_at: string;
}

// File size limits
const BOT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB (Telegram bot limit)
const USERBOT_MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB (Telegram user limit)
const USERBOT_WARN_SIZE = 50 * 1024 * 1024; // 50MB

export class StorageService {
  /**
   * Get user's Telegram client (user-specific or fallback to global)
   * Returns client based on file size and user preferences
   */
  private async getTelegramClientForUser(
    userId: string, 
    fileSize: number
  ): Promise<{ client: TelegramClient; chatId: string; isUserbot: boolean } | null> {
    const { data: user } = await supabaseAdmin
      .from('telecloud_users')
      .select('telegram_bot_token, telegram_chat_id, telegram_api_id, telegram_api_hash, telegram_phone, telegram_use_userbot')
      .eq('id', userId)
      .single();

    // For files >50MB, require userbot
    const needsUserbot = fileSize > BOT_MAX_FILE_SIZE;
    
    if (needsUserbot) {
      // Check if user has userbot configured
      if (user?.telegram_api_id && user?.telegram_api_hash && user?.telegram_phone) {
        // Userbot implementation would go here - for now return bot with warning
        // TODO: Implement actual userbot client using MTProto
        if (user?.telegram_bot_token && user?.telegram_chat_id) {
          return {
            client: new TelegramClient(user.telegram_bot_token, user.telegram_chat_id),
            chatId: user.telegram_chat_id,
            isUserbot: false,
          };
        }
      }
      return null; // Needs userbot but not configured
    }

    // For files <=50MB, use bot (user's or global)
    if (user?.telegram_bot_token && user?.telegram_chat_id) {
      return {
        client: new TelegramClient(user.telegram_bot_token, user.telegram_chat_id),
        chatId: user.telegram_chat_id,
        isUserbot: false,
      };
    }

    const globalToken = process.env.TELEGRAM_BOT_TOKEN;
    const globalChatId = process.env.TELEGRAM_CHAT_ID;

    if (globalToken && globalChatId) {
      return {
        client: new TelegramClient(globalToken, globalChatId),
        chatId: globalChatId,
        isUserbot: false,
      };
    }

    return null;
  }

  /**
   * Upload file with synchronized caption
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

      // Check absolute limits
      if (fileSize > USERBOT_MAX_FILE_SIZE) {
        return { 
          success: false, 
          error: `File size (${(fileSize / 1024 / 1024).toFixed(1)}MB) exceeds 2GB limit. Telegram does not support files larger than 2GB.` 
        };
      }

      // For files >50MB, check if userbot is needed
      if (fileSize > BOT_MAX_FILE_SIZE) {
        const { data: user } = await supabaseAdmin
          .from('telecloud_users')
          .select('telegram_api_id, telegram_api_hash, telegram_phone')
          .eq('id', userId)
          .single();

        if (!user?.telegram_api_id || !user?.telegram_api_hash) {
          return { 
            success: false, 
            error: `File size (${(fileSize / 1024 / 1024).toFixed(1)}MB) exceeds 50MB bot limit. Please configure your Telegram Userbot in Settings to upload files up to 2GB.`,
            needsUserbot: true 
          };
        }
        
        // Userbot not fully implemented yet - return helpful error
        return { 
          success: false, 
          error: `Files over 50MB require Userbot (currently in development). Please upload files under 50MB for now.` 
        };
      }

      const telegramConfig = await this.getTelegramClientForUser(userId, fileSize);
      if (!telegramConfig) {
        return { success: false, error: 'No Telegram bot configured. Please set up your Telegram bot in Settings, or contact admin for global bot access.' };
      }

      const { client: telegram, chatId } = telegramConfig;

      const { data: user } = await supabaseAdmin
        .from('telecloud_users')
        .select('storage_used, storage_limit')
        .eq('id', userId)
        .single();

      if (user && user.storage_used + fileSize > user.storage_limit) {
        return { success: false, error: 'Storage quota exceeded' };
      }

      const detectedMime = mimeType || mime.lookup(key) || 'application/octet-stream';
      const isImage = detectedMime.startsWith('image/');
      const isVideo = detectedMime.startsWith('video/');

      // Build caption using CaptionBuilder
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

      // Send to Telegram with caption
      let message;
      if (isImage && fileSize < 10 * 1024 * 1024) {
        message = await telegram.sendPhoto(fileData, key, caption);
      } else if (isVideo && fileSize < 50 * 1024 * 1024) {
        message = await telegram.sendVideo(fileData, key, caption);
      } else {
        message = await telegram.sendDocument(fileData, key, detectedMime, caption);
      }

      const document = message.document || message.video || message.photo?.[message.photo.length - 1];
      if (!document) {
        return { success: false, error: 'Failed to get file info from Telegram' };
      }

      // Store in database with caption metadata
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
      const { data: currentUser } = await supabaseAdmin
        .from('telecloud_users')
        .select('storage_used')
        .eq('id', userId)
        .single();
      
      if (currentUser) {
        await supabaseAdmin
          .from('telecloud_users')
          .update({ storage_used: currentUser.storage_used + fileSize })
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

      const telegramConfig = await this.getTelegramClientForUser(userId, 0);
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

      const telegramConfig = await this.getTelegramClientForUser(userId, 0);
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

      const telegramConfig = await this.getTelegramClientForUser(userId, 0);
      
      if (telegramConfig) {
        const { client: telegram } = telegramConfig;
        await telegram.deleteMessage(file.telegram_message_id);
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
   * Upload from URL
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

      const contentType = response.headers.get('content-type') || undefined;
      const contentLength = parseInt(response.headers.get('content-length') || '0');

      if (contentLength > USERBOT_MAX_FILE_SIZE) {
        return { success: false, error: 'File size exceeds 2GB limit' };
      }
      
      if (contentLength > BOT_MAX_FILE_SIZE) {
        return { success: false, error: `File size (${(contentLength / 1024 / 1024).toFixed(1)}MB) exceeds 50MB. Configure Userbot in Settings for files up to 2GB.` };
      }

      const arrayBuffer = await response.arrayBuffer();

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

    const telegramConfig = await this.getTelegramClientForUser(userId, 0);
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
