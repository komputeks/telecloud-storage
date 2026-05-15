import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { TelegramClient } from '@/lib/telegram';
import { v4 as uuidv4 } from 'uuid';

// Handle incoming Telegram updates (webhook)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Verify webhook secret (optional but recommended)
    const webhookSecret = request.headers.get('x-telegram-bot-api-secret-token');
    if (process.env.TELEGRAM_WEBHOOK_SECRET && webhookSecret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const message = body.message;
    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const adminChatId = process.env.TELEGRAM_CHAT_ID;
    
    if (!botToken || !adminChatId) {
      return NextResponse.json({ error: 'Bot not configured' }, { status: 500 });
    }

    // Get admin user
    const { data: adminUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('is_admin', true)
      .single();

    if (!adminUser) {
      return NextResponse.json({ error: 'No admin user' }, { status: 500 });
    }

    const telegram = new TelegramClient(botToken, adminChatId);
    const chatId = message.chat?.id?.toString();

    // Only process messages from the configured chat
    if (chatId !== adminChatId) {
      return NextResponse.json({ ok: true });
    }

    let uploadedFile = null;
    let shouldDeleteOriginal = false;

    // Handle document/file upload
    if (message.document) {
      const doc = message.document;
      const fileName = doc.file_name || `file_${Date.now()}`;
      
      // Store file metadata
      const fileId = uuidv4();
      const { data: storedFile, error } = await supabaseAdmin
        .from('files')
        .insert({
          id: fileId,
          user_id: adminUser.id,
          bucket: 'default',
          key: fileName,
          file_name: fileName,
          mime_type: doc.mime_type || 'application/octet-stream',
          size: doc.file_size || 0,
          telegram_file_id: doc.file_id,
          telegram_message_id: message.message_id,
          telegram_chat_id: chatId,
          metadata: {
            uploaded_via: 'telegram_bot',
            original_message_id: message.message_id.toString(),
          },
        })
        .select()
        .single();

      if (!error) {
        uploadedFile = storedFile;
        
        // Update user storage
        const { data: user } = await supabaseAdmin
          .from('users')
          .select('storage_used')
          .eq('id', adminUser.id)
          .single();
        
        if (user) {
          await supabaseAdmin
            .from('users')
            .update({ storage_used: user.storage_used + (doc.file_size || 0) })
            .eq('id', adminUser.id);
        }

        // Send confirmation message
        await telegram.request('sendMessage', {
          chat_id: adminChatId,
          text: `✅ File uploaded successfully!\n\n📁 ${fileName}\n📊 Size: ${formatSize(doc.file_size || 0)}\n🪣 Bucket: default`,
          reply_to_message_id: message.message_id,
        });
      }
    }

    // Handle photo
    else if (message.photo && message.photo.length > 0) {
      const photo = message.photo[message.photo.length - 1]; // Get largest
      const fileName = `photo_${Date.now()}.jpg`;
      
      const fileId = uuidv4();
      const { data: storedFile, error } = await supabaseAdmin
        .from('files')
        .insert({
          id: fileId,
          user_id: adminUser.id,
          bucket: 'default',
          key: fileName,
          file_name: fileName,
          mime_type: 'image/jpeg',
          size: photo.file_size || 0,
          telegram_file_id: photo.file_id,
          telegram_message_id: message.message_id,
          telegram_chat_id: chatId,
          metadata: {
            uploaded_via: 'telegram_bot',
            original_message_id: message.message_id.toString(),
          },
        })
        .select()
        .single();

      if (!error) {
        uploadedFile = storedFile;
        
        await telegram.request('sendMessage', {
          chat_id: adminChatId,
          text: `✅ Photo uploaded successfully!\n\n📁 ${fileName}\n🪣 Bucket: default`,
          reply_to_message_id: message.message_id,
        });
      }
    }

    // Handle video
    else if (message.video) {
      const video = message.video;
      const fileName = video.file_name || `video_${Date.now()}.mp4`;
      
      const fileId = uuidv4();
      const { data: storedFile, error } = await supabaseAdmin
        .from('files')
        .insert({
          id: fileId,
          user_id: adminUser.id,
          bucket: 'default',
          key: fileName,
          file_name: fileName,
          mime_type: video.mime_type || 'video/mp4',
          size: video.file_size || 0,
          telegram_file_id: video.file_id,
          telegram_message_id: message.message_id,
          telegram_chat_id: chatId,
          metadata: {
            uploaded_via: 'telegram_bot',
            original_message_id: message.message_id.toString(),
          },
        })
        .select()
        .single();

      if (!error) {
        uploadedFile = storedFile;
        
        await telegram.request('sendMessage', {
          chat_id: adminChatId,
          text: `✅ Video uploaded successfully!\n\n📁 ${fileName}\n📊 Size: ${formatSize(video.file_size || 0)}\n🪣 Bucket: default`,
          reply_to_message_id: message.message_id,
        });
      }
    }

    // Handle text/URL
    else if (message.text) {
      const text = message.text.trim();
      
      // Check if it's a URL
      if (isValidUrl(text)) {
        // Queue URL for download (we'll process it async)
        const fileName = text.split('/').pop() || `url_file_${Date.now()}`;
        
        // Send processing message
        interface TelegramMessageResult {
          message_id: number;
          chat: { id: number };
        }
        
        const processingMsg = await telegram.request<TelegramMessageResult>('sendMessage', {
          chat_id: adminChatId,
          text: `⏳ Processing URL...\n\n${text}`,
        });

        try {
          // Fetch the file
          const response = await fetch(text);
          if (!response.ok) {
            throw new Error('Failed to fetch URL');
          }

          const contentType = response.headers.get('content-type') || 'application/octet-stream';
          const contentLength = parseInt(response.headers.get('content-length') || '0');
          const arrayBuffer = await response.arrayBuffer();

          // Upload to Telegram
          const uploadResult = await telegram.sendDocument(arrayBuffer, fileName, contentType);
          
          const doc = uploadResult.document;
          if (!doc) {
            throw new Error('Failed to get document from upload');
          }
          
          const fileId = uuidv4();
          
          const { error } = await supabaseAdmin
            .from('files')
            .insert({
              id: fileId,
              user_id: adminUser.id,
              bucket: 'default',
              key: fileName,
              file_name: fileName,
              mime_type: contentType,
              size: contentLength || arrayBuffer.byteLength,
              telegram_file_id: doc.file_id,
              telegram_message_id: uploadResult.message_id,
              telegram_chat_id: chatId,
              metadata: {
                uploaded_via: 'telegram_bot_url',
                source_url: text,
              },
            })
            .select()
            .single();

          if (!error) {
            // Delete processing message
            await telegram.deleteMessage(processingMsg.message_id);
            
            // Delete original URL message
            await telegram.deleteMessage(message.message_id);
            
            // Send confirmation
            await telegram.request('sendMessage', {
              chat_id: adminChatId,
              text: `✅ File uploaded from URL!\n\n📁 ${fileName}\n📊 Size: ${formatSize(contentLength || arrayBuffer.byteLength)}\n🪣 Bucket: default`,
            });
          }
        } catch (err) {
          // Update processing message with error
          await telegram.request('editMessageText', {
            chat_id: adminChatId,
            message_id: processingMsg.message_id,
            text: `❌ Failed to process URL:\n\n${text}\n\nError: ${err}`,
          });
        }
      } else {
        // Not a URL, send help message
        await telegram.request('sendMessage', {
          chat_id: adminChatId,
          text: `📤 Send files, photos, videos, or URLs to upload them to TeleCloud.\n\nCommands:\n/files - List your files\n/buckets - List buckets\n/help - Show this message`,
          reply_to_message_id: message.message_id,
        });
      }
    }

    // Handle forwarded messages
    else if (message.forward_from || message.forward_from_chat) {
      // Mark for deletion after processing
      shouldDeleteOriginal = true;
      
      // The forwarded content should have been handled by the handlers above
      // We just need to delete the forwarded message
      if (shouldDeleteOriginal && uploadedFile) {
        await telegram.deleteMessage(message.message_id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function isValidUrl(string: string): boolean {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
