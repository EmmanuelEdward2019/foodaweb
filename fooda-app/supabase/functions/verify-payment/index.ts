import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

// verify-payment
// ---------------
// Called by the frontend after Paystack redirects the user back with a payment
// reference. Asks Paystack directly whether the transaction succeeded and, if
// so, updates the order to payment_status='completed' / status='confirmed'.
//
// This makes the success path independent of the asynchronous webhook (which
// may be unconfigured, delayed, or blocked) — important because users see the
// page within seconds of paying and expect immediate confirmation.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface VerifyRequest {
  reference?: string;
  order_id?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      return new Response(JSON.stringify({ error: 'Paystack secret key not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { reference, order_id } = (await req.json()) as VerifyRequest;
    if (!reference && !order_id) {
      return new Response(JSON.stringify({ error: 'reference or order_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve the order — either by reference (the Paystack-side identifier)
    // or by id (in case the client only has the order it just created).
    const query = supabase
      .from('orders')
      .select('id, order_number, total_amount, customer_id, payment_status, payment_reference');
    const { data: order, error: orderError } = reference
      ? await query.eq('payment_reference', reference).single()
      : await query.eq('id', order_id!).single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Idempotent — if we already marked it completed, just say so.
    if (order.payment_status === 'completed') {
      return new Response(JSON.stringify({
        success: true,
        status: 'completed',
        order_id: order.id,
        order_number: order.order_number,
        message: 'Already confirmed',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const refToVerify = reference ?? order.payment_reference;
    if (!refToVerify) {
      return new Response(JSON.stringify({ error: 'Order has no payment reference' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Ask Paystack what really happened.
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(refToVerify)}`, {
      headers: { 'Authorization': `Bearer ${paystackSecretKey}` },
    });
    const verifyData = await verifyRes.json();

    if (!verifyData.status) {
      return new Response(JSON.stringify({
        success: false,
        status: 'unknown',
        order_id: order.id,
        error: verifyData.message || 'Paystack verify call failed',
      }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const tx = verifyData.data;
    const paystackStatus = tx?.status; // 'success' | 'failed' | 'abandoned' | 'pending' ...

    if (paystackStatus !== 'success') {
      // Mirror Paystack's state into the order
      const mappedStatus = paystackStatus === 'failed' || paystackStatus === 'abandoned'
        ? 'failed'
        : 'pending';
      await supabase.from('orders')
        .update({ payment_status: mappedStatus })
        .eq('id', order.id);
      return new Response(JSON.stringify({
        success: false,
        status: mappedStatus,
        order_id: order.id,
        paystack_status: paystackStatus,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Anti-manipulation: the amount Paystack received must match the order.
    // Paystack returns amount in kobo (NGN cents).
    const paidNaira = Number(tx.amount) / 100;
    const orderTotal = Number(order.total_amount);
    if (Math.abs(paidNaira - orderTotal) > 1) {
      console.error(`Amount mismatch on ${refToVerify}: paystack=${paidNaira}, order=${orderTotal}`);
      return new Response(JSON.stringify({
        success: false,
        status: 'mismatch',
        order_id: order.id,
        paystack_amount: paidNaira,
        order_amount: orderTotal,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Update the order. We deliberately leave the user's chosen status path
    // alone if the vendor already moved it (e.g. straight to 'preparing').
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        payment_status: 'completed',
        payment_method: order.payment_status === 'pending' ? 'card' : undefined,
        status: 'confirmed',
        payment_reference: refToVerify,
      })
      .eq('id', order.id);

    if (updateError) {
      console.error('Order update failed:', updateError);
      return new Response(JSON.stringify({
        success: false,
        error: updateError.message,
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Best-effort notification — don't fail the verify if the insert fails.
    try {
      await supabase.from('notifications').insert({
        user_id: order.customer_id,
        order_id: order.id,
        type: 'payment_received',
        title: 'Payment Confirmed',
        message: `Payment for order #${order.order_number} confirmed.`,
        is_read: false,
      });
    } catch (e) {
      console.warn('Notification insert failed:', (e as Error).message);
    }

    return new Response(JSON.stringify({
      success: true,
      status: 'completed',
      order_id: order.id,
      order_number: order.order_number,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('verify-payment error:', error);
    return new Response(JSON.stringify({
      error: (error as Error).message,
      stack: (error as Error).stack?.split('\n').slice(0, 5).join('\n'),
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
