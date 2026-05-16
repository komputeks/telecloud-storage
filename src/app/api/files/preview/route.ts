import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { TelegramClient } from '@/lib/telegram';

/**
 * Stream/proxy file content from Telegram CDN for preview.
 * Supports range requests for video/audio seeking.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('id');
    if (!fileId) return NextResponse.json({ error: 'File ID required' }, { status: 400 });

    // Get file record
    const { data: file } = await supabaseAdmin
      .from('telecloud_files')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', user.id)
      .single();

    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    // Get Telegram client
    const { data: userData } = await supabaseAdmin
      .from('telecloud_users')
      .select('telegram_bot_token, telegram_chat_id')
      .eq('id', user.id)
      .single();

    let botToken = userData?.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      const { data: settings } = await supabaseAdmin
        .from('settings')
        .select('value')
        .eq('key', 'TELEGRAM_BOT_TOKEN')
        .single();
      botToken = settings?.value || '';
    }

    if (!botToken) {
      return NextResponse.json({ error: 'No Telegram bot configured' }, { status: 500 });
    }

    const telegram = new TelegramClient(botToken, file.telegram_chat_id);
    const fileUrl = await telegram.getFileUrl(file.telegram_file_id);

    // Proxy the file from Telegram with proper headers
    const rangeHeader = request.headers.get('range');
    const headers: Record<string, string> = {};
    if (rangeHeader) headers['Range'] = rangeHeader;

    const telegramRes = await fetch(fileUrl, { headers });

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', file.mime_type || 'application/octet-stream');
    responseHeaders.set('Content-Disposition', `inline; filename="${file.file_name}"`);
    responseHeaders.set('Cache-Control', 'public, max-age=3600');
    responseHeaders.set('Accept-Ranges', 'bytes');

    const contentLength = telegramRes.headers.get('content-length');
    if (contentLength) responseHeaders.set('Content-Length', contentLength);
    const contentRange = telegramRes.headers.get('content-range');
    if (contentRange) responseHeaders.set('Content-Range', contentRange);

    return new NextResponse(telegramRes.body, {
      status: telegramRes.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Preview error:', error);
    return NextResponse.json({ error: 'Preview failed' }, { status: 500 });
  }
}
