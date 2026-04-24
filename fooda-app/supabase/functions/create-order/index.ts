// Create Order Edge Function
// Import the necessary modules for Supabase Edge Functions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/utils.ts";
import { generateOrderNumber, calculateOrderTotals } from "../_shared/utils.ts";

console.log("Create Order function started");

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Create a Supabase client with the request headers
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: req.headers.get('Authorization')! },
                },
            }
        );

        // Get the session
        const {
            data: { session },
        } = await supabaseClient.auth.getSession();

        if (!session) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
            );
        }

        // Parse the request body
        const { vendor_id, delivery_address, items, notes, delivery_fee } = await req.json();

        // Validate required fields
        if (!vendor_id || !delivery_address || !items || items.length === 0) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: vendor_id, delivery_address, and items are required' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
        }

        // Generate order number
        const order_number = generateOrderNumber();

        // Calculate order totals
        const totals = calculateOrderTotals(items, delivery_fee);

        // Begin database transaction
        const { data: order, error: orderError } = await supabaseClient
            .from('orders')
            .insert({
                customer_id: session.user.id,
                vendor_id,
                order_number,
                delivery_address,
                delivery_fee: totals.deliveryFee,
                subtotal: totals.subtotal,
                tax_amount: totals.taxAmount,
                total_amount: totals.totalAmount,
                notes,
                status: 'pending'
            })
            .select()
            .single();

        if (orderError) {
            console.error('Order creation error:', orderError);
            return new Response(
                JSON.stringify({ error: orderError.message }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            );
        }

        // Insert order items
        const orderItems = items.map((item: any) => ({
            order_id: order.id,
            menu_item_id: item.menu_item_id,
            quantity: item.quantity,
            price_per_unit: item.price_per_unit,
            total_price: item.price_per_unit * item.quantity,
            special_instructions: item.special_instructions
        }));

        const { error: itemsError } = await supabaseClient
            .from('order_items')
            .insert(orderItems);

        if (itemsError) {
            console.error('Order items creation error:', itemsError);
            // Try to delete the order if items creation failed
            await supabaseClient.from('orders').delete().eq('id', order.id);

            return new Response(
                JSON.stringify({ error: itemsError.message }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            );
        }

        // Return the created order
        return new Response(
            JSON.stringify({ order }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 }
        );

    } catch (error) {
        console.error('Unexpected error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
    }
});