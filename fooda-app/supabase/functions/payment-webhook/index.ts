import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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
        customer: {
            email: string;
        };
    };
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Verify Paystack webhook signature (optional but recommended)
        const signature = req.headers.get('x-paystack-signature');
        const body = await req.text();

        // In production, verify the signature using crypto
        // const hash = crypto.createHmac('sha512', paystackSecretKey).update(body).digest('hex');
        // if (hash !== signature) { throw new Error('Invalid signature'); }

        const webhookData = JSON.parse(body) as PaystackWebhookEvent;

        console.log('Received webhook event:', webhookData.event);

        if (webhookData.event === 'charge.success') {
            const { reference, status, amount, metadata, customer } = webhookData.data;
            const orderId = metadata?.order_id;

            if (!orderId) {
                console.error('No order_id in webhook metadata');
                return new Response(
                    JSON.stringify({ error: 'Missing order_id' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Verify the transaction with Paystack
            const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
                headers: {
                    'Authorization': `Bearer ${paystackSecretKey}`,
                },
            });

            const verifyData = await verifyResponse.json();

            if (!verifyData.status || verifyData.data.status !== 'success') {
                console.error('Transaction verification failed:', verifyData);
                return new Response(
                    JSON.stringify({ error: 'Transaction verification failed' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Update order payment status
            const { error: updateError } = await supabase
                .from('orders')
                .update({
                    payment_status: 'completed',
                    payment_method: 'card',
                    status: 'confirmed' // Auto-confirm order after payment
                })
                .eq('id', orderId);

            if (updateError) {
                console.error('Error updating order:', updateError);
                throw updateError;
            }

            // Get order details for notification
            const { data: order } = await supabase
                .from('orders')
                .select('*, vendor:vendors(id, name, email)')
                .eq('id', orderId)
                .single();

            // Send notifications
            if (order) {
                // Notify customer via console (in production, send email/SMS)
                console.log(`Payment confirmed for order ${order.order_number}. Sending notification to ${customer.email}`);

                // Notify vendor
                if (order.vendor?.email) {
                    console.log(`New paid order ${order.order_number} for vendor ${order.vendor.name}`);
                }
            }

            console.log(`Payment successful for order ${orderId}, reference: ${reference}`);

            return new Response(
                JSON.stringify({ success: true, message: 'Payment verified and order updated' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Handle failed payments
        if (webhookData.event === 'charge.failed') {
            const orderId = webhookData.data.metadata?.order_id;

            if (orderId) {
                await supabase
                    .from('orders')
                    .update({ payment_status: 'failed' })
                    .eq('id', orderId);
            }

            return new Response(
                JSON.stringify({ success: true, message: 'Payment failure recorded' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Acknowledge other events
        return new Response(
            JSON.stringify({ received: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Webhook processing error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
