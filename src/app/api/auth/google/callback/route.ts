import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    if (!code) {
      return NextResponse.redirect(new URL('/?error=no_code', request.url));
    }

    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://komputeks-telecloud.vercel.app'}/api/auth/google/callback`;

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokens.access_token) {
      return NextResponse.redirect(new URL('/?error=token_failed', request.url));
    }

    // Get user info
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoRes.json();

    if (!userInfo.email) {
      return NextResponse.redirect(new URL('/?error=no_email', request.url));
    }

    const cleanEmail = userInfo.email.toLowerCase().trim();

    // Check if user exists
    const { data: existingUser } = await supabaseAdmin
      .from('telecloud_users')
      .select('*')
      .eq('email', cleanEmail)
      .maybeSingle();

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      // Update name/avatar if missing
      const updates: Record<string, string> = {};
      if (!existingUser.name && userInfo.name) updates.name = userInfo.name;
      if (Object.keys(updates).length > 0) {
        await supabaseAdmin.from('telecloud_users').update(updates).eq('id', userId);
      }
    } else {
      // Create new user
      const { data: newUser, error } = await supabaseAdmin
        .from('telecloud_users')
        .insert({
          email: cleanEmail,
          password_hash: 'google_oauth',
          name: userInfo.name || cleanEmail.split('@')[0],
          is_admin: false,
          is_upgraded: false,
          storage_used: 0,
          storage_limit: 104857600, // 100MB free
        })
        .select()
        .single();

      if (error || !newUser) {
        return NextResponse.redirect(new URL('/?error=create_failed', request.url));
      }
      userId = newUser.id;

      // Send welcome email
      try {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://komputeks-telecloud.vercel.app'}/api/auth/welcome-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, name: userInfo.name }),
        });
      } catch { /* non-critical */ }
    }

    const token = generateToken(userId);

    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Google callback error:', error);
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url));
  }
}
