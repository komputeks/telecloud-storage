import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const { data: settings, error } = await supabaseAdmin
      .from('settings')
      .select('*');

    if (error) {
      // If table doesn't exist, return defaults
      return NextResponse.json({
        settings: {
          site_name: 'TeleCloud Storage',
          max_file_size: 52428800,
          default_storage_limit: 52428800,
          allow_registration: true,
          require_email_verification: false,
        },
      });
    }

    const settingsMap = settings?.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {} as Record<string, string>) || {};

    return NextResponse.json({ settings: settingsMap });
  } catch (error) {
    console.error('Settings error:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user || !user.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { settings } = await request.json();

    // Update each setting (delete + insert since no unique constraint on key)
    for (const [key, value] of Object.entries(settings)) {
      await supabaseAdmin.from('settings').delete().eq('key', key);
      await supabaseAdmin.from('settings').insert({ key, value: String(value), updated_at: new Date().toISOString() });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings update error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
