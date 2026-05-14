import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface PaystackWebhookEvent {
    event: string;
    data: {
        reference: string;
        status: string;
        amount: number;
        metadata: {
            order_id: string;
            order_number: string;
        };
        customer: { email: string };
    };
}

async function verifyWebhookSignature(body: string, signature: string, secret: string): Promise<boolean> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-512' },
        false,
        ['sign']
    );
    const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const hashArray = Array.from(new Uint8Array(signatureBytes));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hash === signature;
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
        if (!paystackSecretKey) {
            console.error('PAYSTACK_SECRET_KEY not configured');
            return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
                status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const body = await req.text();
        const signature = req.headers.get('x-paystack-signature');

        // Reject unsigned requests
        if (!signature) {
            console.warn('Webhook received without signature — rejected');
            return new Response(JSON.stringify({ error: 'Missing signature' }), {
                status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Verify HMAC-SHA512 signature
        const isValid = await verifyWebhookSignature(body, signature, paystackSecretKey);
        if (!isValid) {
            console.warn('Webhook signature verification failed — rejected');
            return new Response(JSON.stringify({ error: 'Invalid signature' }), {
                status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const webhookData = JSON.parse(body) as PaystackWebhookEvent;
        console.log('Verified webhook event:', webhookData.event);

        if (webhookData.event === 'charge.success') {
            const { reference, amount, metadata, customer } = webhookData.data;
            const orderId = metadata?.order_id;

            if (!orderId) {
                return new Response(JSON.stringify({ error: 'Missing order_id in metadata' }), {
                    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // Verify with Paystack API (secondary check)
            const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
                headers: { 'Authorization': `Bearer ${paystackSecretKey}` }
            });
            const verifyData = await verifyRes.json();

            if (!verifyData.status || verifyData.data?.status !== 'success') {
                console.error('Paystack verification failed:', verifyData);
                return new Response(JSON.stringify({ error: 'Transaction verification failed' }), {
                    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // Check the amount matches what we have on record (anti-manipulation)
            const { data: order, error: orderFetchError } = await supabase
                .from('orders')
                .select('id, order_number, total_amount, payment_status, customer_id, vendor_id')
                .eq('id', orderId)
                .single();

            if (orderFetchError || !order) {
                return new Response(JSON.stringify({ error: 'Order not found' }), {
                    status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // Prevent double-processing
            if (order.payment_status === 'completed') {
                console.log(`Order ${orderId} already marked completed — skipping`);
                return new Response(JSON.stringify({ success: true, message: 'Already processed' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // Verify amount matches (Paystack amount is in kobo, DB is in naira)
            const paystackNaira = amount / 100;
            if (Math.abs(paystackNaira - Number(order.total_amount)) > 1) {
                console.error(`Amount mismatch: Paystack=${paystackNaira}, DB=${order.total_amount}`);
                return new Response(JSON.stringify({ error: 'Amount mismatch' }), {
                    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // Update order
            const { error: updateError } = await supabase
                .from('orders')
                .update({
                    payment_status: 'completed',
                    payment_method: 'card',
                    payment_reference: reference,
                    status: 'confirmed'
                })
                .eq('id', orderId);

            if (updateError) throw updateError;

            // Log in notifications table
            await supabase.from('notifications').insert({
                user_id: order.customer_id,
                order_id: orderId,
                type: 'payment_received',
                title: 'Payment Confirmed',
                message: `Payment for order #${order.order_number} confirmed.`,
                is_read: false
            });

            console.log(`Payment confirmed for order ${orderId}, ref: ${reference}`);

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        if (webhookData.event === 'charge.failed') {
            const orderId = webhookData.data.metadata?.order_id;
            if (orderId) {
                await supabase.from('orders').update({ payment_status: 'failed' }).eq('id', orderId);
            }
            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Webhook error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
