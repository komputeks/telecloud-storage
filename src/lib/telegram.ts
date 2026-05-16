// Telegram Bot API client for file storage

interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}

interface TelegramMessage {
  message_id: number;
  from?: { id: number; first_name: string; username?: string };
  chat: { id: number; type: string };
  document?: TelegramFile & { file_name?: string; mime_type?: string };
  photo?: TelegramFile[];
  video?: TelegramFile & { file_name?: string; mime_type?: string };
  audio?: TelegramFile & { file_name?: string; mime_type?: string };
  caption?: string;
}

interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

const TELEGRAM_API = 'https://api.telegram.org/bot';

export class TelegramClient {
  private botToken: string;
  private chatId: string;

  constructor(botToken?: string, chatId?: string) {
    this.botToken = botToken || process.env.TELEGRAM_BOT_TOKEN || '';
    this.chatId = chatId || process.env.TELEGRAM_CHAT_ID || '';
  }

  async request<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const url = `${TELEGRAM_API}${this.botToken}/${method}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data: TelegramResponse<T> = await response.json();
    
    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description || 'Unknown error'}`);
    }

    return data.result as T;
  }

  // Send a document to Telegram
  async sendDocument(
    file: ArrayBuffer,
    filename: string,
    mimeType: string,
    caption?: string
  ): Promise<TelegramMessage> {
    if (!this.botToken || !this.chatId) {
      throw new Error('Telegram bot token or chat ID is not configured. Please set up in Settings or contact admin.');
    }

    const formData = new FormData();
    formData.append('chat_id', this.chatId);
    formData.append('document', new Blob([file], { type: mimeType }), filename);
    if (caption) {
      formData.append('caption', caption);
    }

    const url = `${TELEGRAM_API}${this.botToken}/sendDocument`;
    const response = await fetch(url, { method: 'POST', body: formData });
    const data: TelegramResponse<TelegramMessage> = await response.json();

    if (!data.ok) {
      const errMsg = data.description || 'Unknown error';
      if (data.error_code === 401) {
        throw new Error(`Telegram bot token is invalid or revoked. Please update in Settings. (${errMsg})`);
      }
      if (data.error_code === 400 && errMsg.includes('chat not found')) {
        throw new Error(`Telegram chat ID is invalid. Please update in Settings. (${errMsg})`);
      }
      throw new Error(`Failed to send document: ${errMsg}`);
    }

    return data.result!;
  }

  // Send a photo to Telegram
  async sendPhoto(
    file: ArrayBuffer,
    filename: string,
    caption?: string
  ): Promise<TelegramMessage> {
    if (!this.botToken || !this.chatId) {
      throw new Error('Telegram bot token or chat ID is not configured.');
    }

    const formData = new FormData();
    formData.append('chat_id', this.chatId);
    formData.append('photo', new Blob([file], { type: 'image/jpeg' }), filename);
    if (caption) {
      formData.append('caption', caption);
    }

    const url = `${TELEGRAM_API}${this.botToken}/sendPhoto`;
    const response = await fetch(url, { method: 'POST', body: formData });
    const data: TelegramResponse<TelegramMessage> = await response.json();

    if (!data.ok) {
      const errMsg = data.description || 'Unknown error';
      if (data.error_code === 401) {
        throw new Error(`Telegram bot token is invalid. Please update in Settings. (${errMsg})`);
      }
      throw new Error(`Failed to send photo: ${errMsg}`);
    }

    return data.result!;
  }

  // Send a video to Telegram
  async sendVideo(
    file: ArrayBuffer,
    filename: string,
    caption?: string
  ): Promise<TelegramMessage> {
    if (!this.botToken || !this.chatId) {
      throw new Error('Telegram bot token or chat ID is not configured.');
    }

    const formData = new FormData();
    formData.append('chat_id', this.chatId);
    formData.append('video', new Blob([file], { type: 'video/mp4' }), filename);
    if (caption) {
      formData.append('caption', caption);
    }

    const url = `${TELEGRAM_API}${this.botToken}/sendVideo`;
    const response = await fetch(url, { method: 'POST', body: formData });
    const data: TelegramResponse<TelegramMessage> = await response.json();

    if (!data.ok) {
      const errMsg = data.description || 'Unknown error';
      if (data.error_code === 401) {
        throw new Error(`Telegram bot token is invalid. Please update in Settings. (${errMsg})`);
      }
      throw new Error(`Failed to send video: ${errMsg}`);
    }

    return data.result!;
  }

  // Get file download URL
  async getFileUrl(fileId: string): Promise<string> {
    const result = await this.request<{ file_path: string }>('getFile', { file_id: fileId });
    return `https://api.telegram.org/file/bot${this.botToken}/${result.file_path}`;
  }

  // Download file from Telegram
  async downloadFile(fileId: string): Promise<{ data: ArrayBuffer; size: number }> {
    const fileUrl = await this.getFileUrl(fileId);
    const response = await fetch(fileUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      data: arrayBuffer,
      size: arrayBuffer.byteLength,
    };
  }

  // Delete a message
  async deleteMessage(messageId: number): Promise<boolean> {
    return this.request<boolean>('deleteMessage', {
      chat_id: this.chatId,
      message_id: messageId,
    });
  }

  // Edit message caption
  async editCaption(messageId: number, caption: string): Promise<TelegramMessage> {
    return this.request<TelegramMessage>('editMessageCaption', {
      chat_id: this.chatId,
      message_id: messageId,
      caption: caption,
    });
  }

  // Forward a message
  async forwardMessage(toChatId: string, messageId: number): Promise<TelegramMessage> {
    return this.request<TelegramMessage>('forwardMessage', {
      chat_id: toChatId,
      from_chat_id: this.chatId,
      message_id: messageId,
    });
  }

  // Get bot info
  async getMe(): Promise<{ id: number; is_bot: boolean; first_name: string; username: string }> {
    return this.request('getMe');
  }

  // Get chat info
  async getChat(): Promise<{ id: number; type: string; title?: string }> {
    return this.request('getChat', { chat_id: this.chatId });
  }
}

// Singleton instance
let telegramClient: TelegramClient | null = null;

export function getTelegramClient(botToken?: string, chatId?: string): TelegramClient {
  if (!telegramClient || botToken || chatId) {
    telegramClient = new TelegramClient(botToken, chatId);
  }
  return telegramClient;
}

export default TelegramClient;
