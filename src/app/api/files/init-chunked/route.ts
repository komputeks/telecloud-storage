import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { bucket = 'default', key, file_name, size, mime_type, total_chunks } = body;
    if (!key || !size || !total_chunks) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

    const { data: userData } = await supabaseAdmin.from('telecloud_users').select('storage_used, storage_limit').eq('id', user.id).single();
    if (userData && userData.storage_used + size > userData.storage_limit) {
      return NextResponse.json({ error: 'Storage quota exceeded' }, { status: 400 });
    }

    const fileId = uuidv4();
    const detectedMime = mime_type || mime.lookup(key) || 'application/octet-stream';

    const { error } = await supabaseAdmin.from('telecloud_files').insert({
      id: fileId, user_id: user.id, bucket, key,
      file_name: file_name || key.split('/').pop() || key,
      mime_type: detectedMime, size,
      telegram_file_id: `chunked:${total_chunks}`,
      telegram_message_id: 0, telegram_chat_id: 'chunked',
      tags: [], custom_metadata: { is_chunked: true, total_chunks },
      metadata: {}, caption_version: 2, caption_synced_at: new Date().toISOString(),
    });

    if (error) return NextResponse.json({ error: 'Failed to initialize upload' }, { status: 500 });
    return NextResponse.json({ file_id: fileId, total_chunks });
  } catch (error) {
    console.error('Init chunked error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Init failed' }, { status: 500 });
  }
}
