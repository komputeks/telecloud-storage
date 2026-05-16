/**
 * Telegram Caption Synchronization Service
 * Enterprise-grade metadata management for Telegram-stored files
 */

import { supabaseAdmin } from '../supabase';
import { TelegramClient } from '../telegram';

// Types
export interface FileMetadata {
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
  caption_version: number;
  caption_synced_at: string;
  custom_metadata: Record<string, unknown>;
  tags: string[];
  is_encrypted: boolean;
  created_at: string;
  updated_at: string;
}

export interface CaptionPayload {
  version: number;
  bucket: string;
  key: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  tags?: string[];
  custom?: Record<string, unknown>;
  checksum?: string;
}

export interface SyncResult {
  success: boolean;
  captionVersion?: number;
  error?: string;
  retryable?: boolean;
}

export interface BatchSyncResult {
  total: number;
  synced: number;
  failed: number;
  errors: Array<{ fileId: string; error: string }>;
}

// Constants
const CAPTION_VERSION = 2;
const MAX_CAPTION_LENGTH = 1024;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const SITE_URL = 'https://komputeks-telecloud.vercel.app';

/**
 * Caption Builder - Creates structured, parseable Telegram captions
 * 
 * NEW FORMAT for files:
 * 📩 {filename}
 * 
 * 🎯 DESCRIPTION
 * {description}
 * 
 * Upload by 💻 {username}
 * 📂 Folder: {folder/bucket}
 * Via: https://komputeks-telecloud.vercel.app
 */
export class CaptionBuilder {
  /**
   * Build a Telegram caption from file metadata
   */
  static build(
    metadata: Partial<FileMetadata>,
    custom?: Record<string, unknown>,
    username?: string
  ): string {
    const fileName = metadata.file_name || metadata.key || 'file';
    const description = (custom?.description as string) || (metadata.custom_metadata?.description as string) || '';
    const bucket = metadata.bucket || 'default';
    const user = username || 'User';

    const lines: string[] = [
      `📩 ${fileName}`,
    ];

    if (description) {
      lines.push('');
      lines.push('🎯 DESCRIPTION');
      lines.push(description);
    }

    lines.push('');
    lines.push(`Upload by 💻 ${user}`);
    lines.push(`📂 Folder: ${bucket}`);
    lines.push(`Via: ${SITE_URL}`);

    const result = lines.join('\n');
    return result.length > MAX_CAPTION_LENGTH ? result.slice(0, MAX_CAPTION_LENGTH) : result;
  }

  /**
   * Build a Telegram message format
   * 
   * {message}
   * 
   * Posted by {username}
   * via https://komputeks-telecloud.vercel.app
   */
  static buildMessage(content: string, username?: string): string {
    const user = username || 'User';
    const lines: string[] = [
      content,
      '',
      `Posted by ${user}`,
      '',
      `via ${SITE_URL}`,
    ];
    return lines.join('\n');
  }

  /**
   * Parse a Telegram caption back to metadata
   */
  static parse(caption: string): Partial<CaptionPayload> | null {
    if (!caption) return null;

    try {
      const lines = caption.split('\n');
      const result: Partial<CaptionPayload> = {};

      for (const line of lines) {
        if (line.startsWith('📂 Folder: ')) {
          result.bucket = line.slice('📂 Folder: '.length).trim();
        } else if (line.startsWith('📩 ')) {
          result.fileName = line.slice(3).trim();
        } else if (line.startsWith('📂 ') && line.includes('/')) {
          const path = line.slice(3).trim();
          const slashIndex = path.indexOf('/');
          if (slashIndex > -1) {
            result.bucket = path.slice(0, slashIndex);
            result.key = path.slice(slashIndex + 1);
          }
        }
      }

      return result;
    } catch {
      return null;
    }
  }

  /**
   * Format bytes to human readable
   */
  static formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

/**
 * Caption Synchronization Service
 * Handles bidirectional sync between database and Telegram captions
 */
export class CaptionSyncService {
  /**
   * Sync caption to Telegram (with retry logic)
   */
  static async syncToTelegram(
    telegram: TelegramClient,
    chatId: string,
    messageId: number,
    fileMetadata: Partial<FileMetadata>,
    customMetadata?: Record<string, unknown>,
    username?: string
  ): Promise<SyncResult> {
    const caption = CaptionBuilder.build(fileMetadata, customMetadata, username);

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await telegram.editCaption(messageId, caption);

        // Update sync status in DB
        if (fileMetadata.id) {
          await supabaseAdmin
            .from('telecloud_files')
            .update({
              caption_version: CAPTION_VERSION,
              caption_synced_at: new Date().toISOString(),
            })
            .eq('id', fileMetadata.id);
        }

        return { success: true, captionVersion: CAPTION_VERSION };
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';

        // Rate limit — wait and retry
        if (errMsg.includes('Too Many Requests') || errMsg.includes('429')) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
          continue;
        }

        // Non-retryable errors
        if (errMsg.includes('message to edit not found') ||
            errMsg.includes('message can\'t be edited')) {
          return { success: false, error: errMsg, retryable: false };
        }

        if (attempt === MAX_RETRIES - 1) {
          return { success: false, error: errMsg, retryable: true };
        }

        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }

    return { success: false, error: 'Max retries exceeded', retryable: true };
  }

  /**
   * Batch sync multiple files
   */
  static async batchSync(
    files: Array<{
      id: string;
      telegram_message_id: number;
      telegram_chat_id: string;
      metadata: Partial<FileMetadata>;
    }>,
    getTelegram: (chatId: string) => Promise<TelegramClient>
  ): Promise<BatchSyncResult> {
    const result: BatchSyncResult = {
      total: files.length,
      synced: 0,
      failed: 0,
      errors: [],
    };

    for (const file of files) {
      if (!file.telegram_message_id) {
        result.failed++;
        result.errors.push({ fileId: file.id, error: 'No Telegram message ID' });
        continue;
      }

      try {
        const telegram = await getTelegram(file.telegram_chat_id);
        const syncResult = await this.syncToTelegram(
          telegram,
          file.telegram_chat_id,
          file.telegram_message_id,
          file.metadata
        );

        if (syncResult.success) {
          result.synced++;
        } else {
          result.failed++;
          result.errors.push({ fileId: file.id, error: syncResult.error || 'Unknown' });
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          fileId: file.id,
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }

      // Rate limiting: small delay between syncs
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return result;
  }
}

/**
 * Metadata Change Tracker
 */
export class MetadataChangeTracker {
  static async recordChange(
    fileId: string,
    changeType: string,
    oldValue: Record<string, unknown>,
    newValue: Record<string, unknown>
  ): Promise<void> {
    try {
      await supabaseAdmin.from('telecloud_metadata_changes').insert({
        file_id: fileId,
        change_type: changeType,
        old_value: oldValue,
        new_value: newValue,
        created_at: new Date().toISOString(),
      });
    } catch {
      // Non-critical — silently ignore
    }
  }
}
