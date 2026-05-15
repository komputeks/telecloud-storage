import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function PUT(request: NextRequest) {
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

    const { oldName, newName } = await request.json();

    if (!oldName || !newName) {
      return NextResponse.json({ error: 'Old name and new name are required' }, { status: 400 });
    }

    if (oldName === 'default') {
      return NextResponse.json({ error: 'Cannot rename default bucket' }, { status: 400 });
    }

    // Update all files in the bucket to the new bucket name
    const { error } = await supabaseAdmin
      .from('files')
      .update({ bucket: newName })
      .eq('user_id', user.id)
      .eq('bucket', oldName);

    if (error) {
      return NextResponse.json({ error: 'Failed to rename bucket' }, { status: 500 });
    }

    return NextResponse.json({ success: true, newName });
  } catch (error) {
    console.error('Bucket rename error:', error);
    return NextResponse.json({ error: 'Rename failed' }, { status: 500 });
  }
}
