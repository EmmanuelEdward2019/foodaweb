// Process Payment Edge Function with Paystack for Supabase Deployment
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Parse the request body
        const { order_id, amount, email, metadata } = await req.json();

        // Validate required fields
        if (!order_id || !amount || !email) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: order_id, amount, and email are required' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
        }

        // Get Paystack secret key from environment variables
        const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');

        if (!paystackSecretKey) {
            return new Response(
                JSON.stringify({ error: 'Payment configuration error' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            );
        }

        // Create a payment request with Paystack
        const response = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${paystackSecretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: Math.round(amount * 100), // Convert to kobo (smallest currency unit)
                email: email,
                reference: `ORDER-${order_id}-${Date.now()}`,
                callback_url: 'https://your-app.com/payment/callback',
                metadata: {
                    order_id: order_id,
                    custom_fields: metadata || {}
                }
            }),
        });

        const data = await response.json();

        if (!response.ok || !data.status) {
            return new Response(
                JSON.stringify({ error: data.message || 'Payment initialization failed' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            );
        }

        // Return the payment authorization URL
        return new Response(
            JSON.stringify({
                payment_url: data.data.authorization_url,
                reference: data.data.reference
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );

    } catch (error) {
        console.error('Payment processing error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
    }
});