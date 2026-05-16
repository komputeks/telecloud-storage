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

// POST - Create new API key (one per user, no name required)
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    // Check if user already has a key
    const { data: existing } = await supabaseAdmin
      .from('telecloud_api_keys')
      .select('id')
      .eq('user_id', user.id);

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'You already have an API key. Delete it first to create a new one.' }, { status: 400 });
    }

    // Generate API key: tc_<random 40 chars>
    const rawKey = `tc_${randomBytes(30).toString('base64url')}`;
    const prefix = rawKey.slice(0, 10) + '...';
    const keyHash = hashKey(rawKey);

    const { data: apiKey, error } = await supabaseAdmin
      .from('telecloud_api_keys')
      .insert({
        user_id: user.id,
        name: 'API Key',
        key_prefix: prefix,
        key_hash: keyHash,
        permissions: 'read,write,delete',
        expires_at: null, // never expires
      })
      .select()
      .single();

    if (error) {
      console.error('Create API key error:', error);
      return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
    }

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
