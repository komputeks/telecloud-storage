import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const ref = request.nextUrl.searchParams.get('reference');
    if (!ref) return NextResponse.json({ error: 'Reference required' }, { status: 400 });

    const lipiaKey = process.env.LIPIA_API_KEY;
    if (!lipiaKey || lipiaKey === 'placeholder') {
      return NextResponse.json({ error: 'Payment system not configured' }, { status: 503 });
    }

    // Poll Lipia for status
    const res = await fetch(`https://lipia-api.kreativelabske.com/api/v2/payments/status?reference=${ref}`, {
      headers: { 'Authorization': `Bearer ${lipiaKey}` },
    });

    const result = await res.json();
    const paymentData = result.data?.response;
    const status = paymentData?.Status; // PENDING, SUCCESS, FAILED

    if (status === 'SUCCESS') {
      // Update purchase record
      await supabaseAdmin.from('telecloud_purchases')
        .update({
          status: 'success',
          mpesa_receipt: paymentData?.MpesaReceiptNumber || '',
          updated_at: new Date().toISOString(),
        })
        .eq('transaction_reference', ref);

      // Upgrade user
      await supabaseAdmin.from('telecloud_users')
        .update({
          is_upgraded: true,
          storage_limit: 0, // unlimited
        })
        .eq('id', user.id);

      return NextResponse.json({ status: 'success', message: 'Payment successful! Account upgraded.' });
    }

    if (status === 'FAILED') {
      await supabaseAdmin.from('telecloud_purchases')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('transaction_reference', ref);

      return NextResponse.json({ status: 'failed', message: paymentData?.ResultDesc || 'Payment failed' });
    }

    return NextResponse.json({ status: 'pending', message: 'Payment is being processed...' });
  } catch (error) {
    console.error('Payment status error:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}
