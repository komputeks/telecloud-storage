import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const paymentData = body.data?.response || body;
    const ref = paymentData?.TransactionReference || body.TransactionReference;
    const status = paymentData?.Status;

    if (!ref) return NextResponse.json({ ok: true });

    if (status === 'SUCCESS') {
      const { data: purchase } = await supabaseAdmin.from('telecloud_purchases')
        .select('user_id')
        .eq('transaction_reference', ref)
        .maybeSingle();

      if (purchase) {
        await supabaseAdmin.from('telecloud_purchases')
          .update({
            status: 'success',
            mpesa_receipt: paymentData?.MpesaReceiptNumber || '',
            updated_at: new Date().toISOString(),
          })
          .eq('transaction_reference', ref);

        await supabaseAdmin.from('telecloud_users')
          .update({ is_upgraded: true, storage_limit: 0 })
          .eq('id', purchase.user_id);
      }
    } else if (status === 'FAILED') {
      await supabaseAdmin.from('telecloud_purchases')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('transaction_reference', ref);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Payment callback error:', error);
    return NextResponse.json({ ok: true });
  }
}
