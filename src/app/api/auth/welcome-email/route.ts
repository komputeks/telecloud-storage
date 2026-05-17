import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY || 'placeholder');
}

export async function POST(request: NextRequest) {
  try {
    const { email, name } = await request.json();
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://komputeks-telecloud.vercel.app';

    await getResend().emails.send({
      from: 'TeleCloud <noreply@resend.dev>',
      to: email,
      subject: 'Welcome to TeleCloud! 🚀',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #6366f1;">Welcome to TeleCloud! 🎉</h2>
          <p>Hi ${name || 'there'},</p>
          <p>Your TeleCloud account is ready. You can now:</p>
          <ul style="line-height: 1.8;">
            <li>📁 Upload and manage files via Telegram</li>
            <li>💬 Send messages to your channel</li>
            <li>🔒 Secure cloud storage with S3-compatible API</li>
          </ul>
          <a href="${siteUrl}" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">Open TeleCloud</a>
          <p style="color: #666; font-size: 14px;">Upgrade to Premium for unlimited storage with your own Telegram bot.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px;">TeleCloud Storage — ${siteUrl}</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Welcome email error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
