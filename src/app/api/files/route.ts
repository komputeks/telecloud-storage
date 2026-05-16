import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { storageService } from '@/lib/storage';
import { supabaseAdmin } from '@/lib/supabase';

// GET - List files with pagination support
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const bucket = searchParams.get('bucket') || 'default';
    const prefix = searchParams.get('prefix') || undefined;
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search') || '';

    // Get files with pagination
    let query = supabaseAdmin
      .from('telecloud_files')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('bucket', bucket)
      .order('created_at', { ascending: false });

    if (prefix) {
      query = query.like('key', `${prefix}%`);
    }
    if (search) {
      query = query.ilike('file_name', `%${search}%`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: files, error, count } = await query;

    if (error) {
      console.error('List files error:', error);
      return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
    }

    // Get buckets
    const buckets = await storageService.listBuckets(user.id);

    return NextResponse.json({
      files: files || [],
      buckets,
      total: count || 0,
      hasMore: (offset + limit) < (count || 0),
    });
  } catch (error) {
    console.error('List files error:', error);
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
  }
}

// DELETE - Delete a file
export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { bucket, key, keys } = body;

    // Support batch delete
    if (keys && Array.isArray(keys)) {
      let deleted = 0;
      for (const k of keys) {
        const success = await storageService.deleteFile(user.id, bucket, k);
        if (success) deleted++;
      }
      return NextResponse.json({ success: true, deleted });
    }

    if (!bucket || !key) {
      return NextResponse.json({ error: 'Bucket and key are required' }, { status: 400 });
    }

    const success = await storageService.deleteFile(user.id, bucket, key);

    if (!success) {
      return NextResponse.json({ error: 'File not found or delete failed' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete file error:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}
