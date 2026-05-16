import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { randomBytes, createHash } from 'crypto';

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

// GET - List user's API keys
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { data: keys } = await supabaseAdmin
      .from('telecloud_api_keys')
      .select('id, name, key_prefix, permissions, last_used_at, expires_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    return NextResponse.json({ keys: keys || [] });
  } catch (error) {
    console.error('List API keys error:', error);
    return NextResponse.json({ error: 'Failed to list API keys' }, { status: 500 });
  }
}

// POST - Create new API key
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { name, permissions, expires_in_days } = await request.json();
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    // Generate API key: tc_<random 40 chars>
    const rawKey = `tc_${randomBytes(30).toString('base64url')}`;
    const prefix = rawKey.slice(0, 10) + '...';
    const keyHash = hashKey(rawKey);

    const expiresAt = expires_in_days
      ? new Date(Date.now() + expires_in_days * 86400000).toISOString()
      : null;

    const { data: apiKey, error } = await supabaseAdmin
      .from('telecloud_api_keys')
      .insert({
        user_id: user.id,
        name,
        key_prefix: prefix,
        key_hash: keyHash,
        permissions: permissions || 'read,write,delete',
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
    }

    // Return the full key only once — it cannot be retrieved later
    return NextResponse.json({
      key: { ...apiKey, full_key: rawKey },
      message: 'Save this key now. It will not be shown again.',
    });
  } catch (error) {
    console.error('Create API key error:', error);
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }
}

// DELETE - Revoke an API key
export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { keyId } = await request.json();
    if (!keyId) return NextResponse.json({ error: 'Key ID required' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('telecloud_api_keys')
      .delete()
      .eq('id', keyId)
      .eq('user_id', user.id);

    if (error) return NextResponse.json({ error: 'Failed to revoke key' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete API key error:', error);
    return NextResponse.json({ error: 'Failed to revoke key' }, { status: 500 });
  }
}
