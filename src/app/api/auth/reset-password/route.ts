import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { Resend } from 'resend';
import jwt from 'jsonwebtoken';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY || 'placeholder');
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    const cleanEmail = email.toLowerCase().trim();

    const { data: user } = await supabaseAdmin
      .from('telecloud_users')
      .select('id, name')
      .eq('email', cleanEmail)
      .maybeSingle();

    // Always return success to prevent email enumeration
    if (!user) return NextResponse.json({ success: true });

    // Generate reset token (valid 1 hour)
    const resetToken = jwt.sign(
      { userId: user.id, type: 'reset' },
      process.env.JWT_SECRET || 'telecloud-jwt-secret-2024',
      { expiresIn: '1h' }
    );

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://komputeks-telecloud.vercel.app';
    const resetLink = `${siteUrl}?reset_token=${resetToken}`;

    await getResend().emails.send({
      from: 'TeleCloud <noreply@resend.dev>',
      to: cleanEmail,
      subject: 'Reset your TeleCloud password',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #6366f1;">Password Reset</h2>
          <p>Hi ${user.name || 'there'},</p>
          <p>Click the button below to reset your password. This link expires in 1 hour.</p>
          <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">Reset Password</a>
          <p style="color: #666; font-size: 14px;">If you didn't request this, ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px;">TeleCloud Storage</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Failed to send reset email' }, { status: 500 });
  }
}

// Handle the actual password reset
export async function PUT(request: NextRequest) {
  try {
    const { token, password } = await request.json();
    if (!token || !password) return NextResponse.json({ error: 'Token and password required' }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'telecloud-jwt-secret-2024') as { userId: string; type: string };
    if (decoded.type !== 'reset') return NextResponse.json({ error: 'Invalid token' }, { status: 400 });

    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 12);

    const { error } = await supabaseAdmin
      .from('telecloud_users')
      .update({ password_hash: passwordHash })
      .eq('id', decoded.userId);

    if (error) return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
  }
}
