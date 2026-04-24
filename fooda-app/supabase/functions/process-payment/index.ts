import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface PaymentRequest {
    order_id: string;
    amount: number;
    email: string;
    callback_url?: string;
}

interface PaystackInitResponse {
    status: boolean;
    message: string;
    data: {
        authorization_url: string;
        access_code: string;
        reference: string;
    };
}

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');

        if (!paystackSecretKey) {
            throw new Error('Paystack secret key not configured');
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { order_id, amount, email, callback_url } = await req.json() as PaymentRequest;

        // Validate request
        if (!order_id || !amount || !email) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: order_id, amount, email' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Verify order exists and belongs to user
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('id, order_number, total_amount, payment_status')
            .eq('id', order_id)
            .single();

        if (orderError || !order) {
            return new Response(
                JSON.stringify({ error: 'Order not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (order.payment_status === 'completed') {
            return new Response(
                JSON.stringify({ error: 'Order already paid' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Generate unique reference
        const reference = `fooda_${order.order_number}_${Date.now()}`;

        // Initialize Paystack transaction
        const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${paystackSecretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                amount: Math.round(amount * 100), // Paystack expects amount in kobo/cents
                reference,
                callback_url: callback_url || `${Deno.env.get('APP_URL') || 'http://localhost:3000'}/payment/callback`,
                metadata: {
                    order_id,
                    order_number: order.order_number,
                    custom_fields: [
                        {
                            display_name: "Order Number",
                            variable_name: "order_number",
                            value: order.order_number
                        }
                    ]
                }
            }),
        });

        const paystackData = await paystackResponse.json() as PaystackInitResponse;

        if (!paystackData.status) {
            console.error('Paystack error:', paystackData);
            return new Response(
                JSON.stringify({ error: paystackData.message || 'Payment initialization failed' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Store payment reference in database
        await supabase
            .from('orders')
            .update({
                payment_status: 'pending',
                notes: order.notes ? `${order.notes}\nPayment Reference: ${reference}` : `Payment Reference: ${reference}`
            })
            .eq('id', order_id);

        // Create wallet transaction record (pending)
        await supabase
            .from('wallet_transactions')
            .insert({
                user_id: (await supabase.from('orders').select('customer_id').eq('id', order_id).single()).data?.customer_id,
                order_id,
                transaction_type: 'debit',
                amount,
                balance_after: 0, // Will be updated on completion
                description: `Payment for order ${order.order_number} (${reference})`
            });

        return new Response(
            JSON.stringify({
                success: true,
                payment_url: paystackData.data.authorization_url,
                reference: paystackData.data.reference,
                access_code: paystackData.data.access_code
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Payment processing error:', error);
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});