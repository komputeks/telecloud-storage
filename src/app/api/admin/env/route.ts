import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET - Fetch environment variables
export async function GET() {
  try {
    // Try to get from settings table (stored in Supabase)
    const { data: settings, error } = await supabaseAdmin
      .from('settings')
      .select('*')
      .in('key', ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'JWT_SECRET']);

    if (error) {
      return NextResponse.json({ variables: [] });
    }

    const variables = settings?.map(s => ({
      key: s.key,
      value: s.value || '',
      is_set: !!s.value,
    })) || [];

    return NextResponse.json({ variables });
  } catch (error) {
    console.error('Get env error:', error);
    return NextResponse.json({ variables: [] });
  }
}

// PUT - Save environment variables to Supabase settings
export async function PUT(request: NextRequest) {
  try {
    const { variables } = await request.json();

    if (!variables || !Array.isArray(variables)) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    // Save each variable to settings table
    for (const variable of variables) {
      if (variable.key && variable.value !== undefined) {
        await supabaseAdmin
          .from('settings')
          .upsert({ 
            key: variable.key, 
            value: variable.value,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
      }
    }

    return NextResponse.json({ success: true, message: 'Environment variables saved. Redeploy to apply changes.' });
  } catch (error) {
    console.error('Save env error:', error);
    return NextResponse.json({ error: 'Failed to save environment variables' }, { status: 500 });
  }
}
