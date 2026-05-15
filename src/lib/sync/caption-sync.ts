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
const CAPTION_PREFIX = '☁️ TeleCloud';
const CAPTION_VERSION = 2;
const MAX_CAPTION_LENGTH = 1024; // Telegram limit
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Caption Builder - Creates structured, parseable Telegram captions
 */
export class CaptionBuilder {
  /**
   * Build a Telegram caption from file metadata
   */
  static build(metadata: Partial<FileMetadata>, custom?: Record<string, unknown>): string {
    const payload: CaptionPayload = {
      version: CAPTION_VERSION,
      bucket: metadata.bucket || 'default',
      key: metadata.key || '',
      fileName: metadata.file_name || 'file',
      mimeType: metadata.mime_type || 'application/octet-stream',
      size: metadata.size || 0,
      uploadedAt: metadata.created_at || new Date().toISOString(),
      tags: metadata.tags || [],
      custom: custom || metadata.custom_metadata || {},
    };

    return this.encode(payload);
  }

  /**
   * Encode payload to caption string
   */
  private static encode(payload: CaptionPayload): string {
    const lines: string[] = [
      CAPTION_PREFIX,
      `📦 ${payload.fileName}`,
      `📂 ${payload.bucket}/${payload.key}`,
      `📊 ${this.formatSize(payload.size)} • ${payload.mimeType}`,
      `🕐 ${new Date(payload.uploadedAt).toLocaleDateString()}`,
    ];

    // Add tags if present
    if (payload.tags && payload.tags.length > 0) {
      lines.push(`🏷️ ${payload.tags.slice(0, 5).join(', ')}`);
    }

    // Add custom metadata as JSON (if space permits)
    const baseLength = lines.join('\n').length;
    if (payload.custom && Object.keys(payload.custom).length > 0) {
      const customJson = JSON.stringify(payload.custom);
      if (baseLength + customJson.length + 20 <= MAX_CAPTION_LENGTH) {
        lines.push(`⚙️ ${customJson}`);
      }
    }

    // Add version marker for parsing
    lines.push(`\n_v${payload.version}_${this.checksum(payload)}`);

    return lines.join('\n');
  }

  /**
   * Parse a Telegram caption back to metadata
   */
  static parse(caption: string): Partial<CaptionPayload> | null {
    if (!caption || !caption.includes(CAPTION_PREFIX)) {
      return null;
    }

    try {
      const lines = caption.split('\n');
      const result: Partial<CaptionPayload> = {};

      for (const line of lines) {
        if (line.startsWith('📂 ')) {
          const path = line.slice(3).trim();
          const slashIndex = path.indexOf('/');
          if (slashIndex > -1) {
            result.bucket = path.slice(0, slashIndex);
            result.key = path.slice(slashIndex + 1);
          }
        } else if (line.startsWith('📦 ')) {
          result.fileName = line.slice(3).trim();
        } else if (line.startsWith('📊 ')) {
          const parts = line.slice(3).split('•');
          result.mimeType = parts[1]?.trim() || 'application/octet-stream';
        } else if (line.startsWith('🏷️ ')) {
          result.tags = line.slice(3).split(',').map(t => t.trim());
        } else if (line.startsWith('⚙️ ')) {
          try {
            result.custom = JSON.parse(line.slice(3));
          } catch {}
        }
      }

      // Extract version
      const versionMatch = caption.match(/_v(\d+)_/);
      if (versionMatch) {
        result.version = parseInt(versionMatch[1], 10);
      }

      return result;
    } catch {
      return null;
    }
  }

  /**
   * Generate checksum for caption integrity
   */
  private static checksum(payload: CaptionPayload): string {
    const data = `${payload.bucket}:${payload.key}:${payload.size}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).slice(0, 8);
  }

  /**
   * Format bytes to human readable
   */
  private static formatSize(bytes: number): string {
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
    metadata: Partial<FileMetadata>,
    customMetadata?: Record<string, unknown>
  ): Promise<SyncResult> {
    const caption = CaptionBuilder.build(metadata, customMetadata);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.editCaption(telegram, chatId, messageId, caption);
        
        // Update sync timestamp in database
        await supabaseAdmin
          .from('files')
          .update({
            caption_version: CAPTION_VERSION,
            caption_synced_at: new Date().toISOString(),
          })
          .eq('id', metadata.id);

        return { success: true, captionVersion: CAPTION_VERSION };
      } catch (error) {
        const isRetryable = this.isRetryableError(error);
        
        if (attempt < MAX_RETRIES && isRetryable) {
          await this.delay(RETRY_DELAY_MS * attempt);
          continue;
        }

        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          retryable: isRetryable,
        };
      }
    }

    return { success: false, error: 'Max retries exceeded', retryable: false };
  }

  /**
   * Sync caption from Telegram to database (import/recovery)
   */
  static async syncFromTelegram(
    fileId: string,
    caption: string
  ): Promise<SyncResult> {
    const parsed = CaptionBuilder.parse(caption);

    if (!parsed) {
      return { success: false, error: 'Invalid caption format' };
    }

    try {
      const { error } = await supabaseAdmin
        .from('files')
        .update({
          bucket: parsed.bucket,
          key: parsed.key,
          file_name: parsed.fileName,
          mime_type: parsed.mimeType,
          tags: parsed.tags || [],
          custom_metadata: parsed.custom || {},
          caption_version: parsed.version || 1,
          caption_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', fileId);

      if (error) throw error;

      return { success: true, captionVersion: parsed.version };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Database update failed',
      };
    }
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
    getTelegramClient: (userId: string) => Promise<TelegramClient | null>
  ): Promise<BatchSyncResult> {
    const result: BatchSyncResult = {
      total: files.length,
      synced: 0,
      failed: 0,
      errors: [],
    };

    // Process in parallel batches of 5
    const batchSize = 5;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      
      await Promise.allSettled(
        batch.map(async (file) => {
          const telegram = await getTelegramClient(file.metadata.user_id || '');
          if (!telegram) {
            result.failed++;
            result.errors.push({ fileId: file.id, error: 'Telegram client not available' });
            return;
          }

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
            result.errors.push({ fileId: file.id, error: syncResult.error || 'Unknown error' });
          }
        })
      );

      // Rate limiting: small delay between batches
      if (i + batchSize < files.length) {
        await this.delay(100);
      }
    }

    return result;
  }

  /**
   * Edit caption on Telegram message
   */
  private static async editCaption(
    telegram: TelegramClient,
    chatId: string,
    messageId: number,
    caption: string
  ): Promise<void> {
    const url = `https://api.telegram.org/bot${telegram['botToken']}/editMessageCaption`;
    
    // Fallback to simpler caption if it's too long
    if (caption.length > 1024) {
      caption = caption.substring(0, 1020) + '...';
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        caption: caption,
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.description || 'Failed to edit caption');
    }
  }

  /**
   * Check if error is retryable
   */
  private static isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('timeout') ||
        message.includes('rate limit') ||
        message.includes('too many requests') ||
        message.includes('internal server error')
      );
    }
    return false;
  }

  /**
   * Delay helper
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Metadata Change Tracker
 * Tracks and queues metadata changes for sync
 */
export class MetadataChangeTracker {
  /**
   * Record a metadata change event
   */
  static async recordChange(
    fileId: string,
    changeType: 'update' | 'move' | 'rename' | 'delete',
    oldValue: Record<string, unknown>,
    newValue: Record<string, unknown>
  ): Promise<void> {
    await supabaseAdmin.from('metadata_changes').insert({
      file_id: fileId,
      change_type: changeType,
      old_value: oldValue,
      new_value: newValue,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
  }

  /**
   * Get pending changes for a file
   */
  static async getPendingChanges(fileId: string): Promise<Array<{
    id: string;
    change_type: string;
    old_value: Record<string, unknown>;
    new_value: Record<string, unknown>;
  }>> {
    const { data } = await supabaseAdmin
      .from('metadata_changes')
      .select('*')
      .eq('file_id', fileId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    return data || [];
  }

  /**
   * Mark change as synced
   */
  static async markSynced(changeId: string): Promise<void> {
    await supabaseAdmin
      .from('metadata_changes')
      .update({ status: 'synced', synced_at: new Date().toISOString() })
      .eq('id', changeId);
  }
}

export default CaptionSyncService;
