import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { phone } = await request.json();
    if (!phone) return NextResponse.json({ error: 'Phone number required' }, { status: 400 });

    const lipiaKey = process.env.LIPIA_API_KEY;
    if (!lipiaKey || lipiaKey === 'placeholder') {
      return NextResponse.json({ error: 'Payment system not configured' }, { status: 503 });
    }

    // Initiate STK push via Lipia
    const externalRef = `tc_${user.id.slice(0, 8)}_${Date.now()}`;
    const callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://komputeks-telecloud.vercel.app'}/api/payments/callback`;

    const res = await fetch('https://lipia-api.kreativelabske.com/api/v2/payments/stk-push', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lipiaKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone_number: phone,
        amount: 100,
        external_reference: externalRef,
        callback_url: callbackUrl,
        metadata: {
          user_id: user.id,
          user_email: user.email,
          plan: 'premium',
        },
      }),
    });

    const result = await res.json();

    if (!result.success) {
      return NextResponse.json({ error: result.customerMessage || 'Payment initiation failed' }, { status: 400 });
    }

    const transactionRef = result.data?.TransactionReference;

    // Record purchase
    await supabaseAdmin.from('telecloud_purchases').insert({
      user_id: user.id,
      phone,
      amount: 100,
      transaction_reference: transactionRef,
      status: 'pending',
      metadata: { external_reference: externalRef },
    });

    return NextResponse.json({
      success: true,
      transaction_reference: transactionRef,
      message: 'Check your phone for the M-Pesa prompt',
    });
  } catch (error) {
    console.error('STK push error:', error);
    return NextResponse.json({ error: 'Payment failed' }, { status: 500 });
  }
}
