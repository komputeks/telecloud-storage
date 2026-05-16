import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { file_id } = await request.json();
    if (!file_id) return NextResponse.json({ error: 'file_id required' }, { status: 400 });

    const { data: file } = await supabaseAdmin.from('telecloud_files').select('*').eq('id', file_id).eq('user_id', user.id).single();
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    const totalChunks = (file.custom_metadata as Record<string, number>)?.total_chunks;
    if (!totalChunks) return NextResponse.json({ error: 'Not a chunked file' }, { status: 400 });

    const { data: chunks } = await supabaseAdmin.from('telecloud_file_chunks').select('chunk_index').eq('file_id', file_id).order('chunk_index', { ascending: true });
    if (!chunks || chunks.length !== totalChunks) {
      return NextResponse.json({ error: `Missing ${totalChunks - (chunks?.length || 0)} chunk(s)` }, { status: 400 });
    }

    const { data: currentUser } = await supabaseAdmin.from('telecloud_users').select('storage_used').eq('id', user.id).single();
    if (currentUser) {
      await supabaseAdmin.from('telecloud_users').update({ storage_used: currentUser.storage_used + file.size }).eq('id', user.id);
    }

    return NextResponse.json({ success: true, file });
  } catch (error) {
    console.error('Finalize error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Finalize failed' }, { status: 500 });
  }
}
