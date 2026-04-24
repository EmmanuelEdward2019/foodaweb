// Update Order Status Edge Function for Supabase Deployment

// This is the actual implementation that will work when deployed to Supabase Edge Functions
// The imports will resolve correctly in the Supabase environment

// Import statements that will work in Supabase Edge Functions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
        const { order_id, status } = await req.json();

        // Validate required fields
        if (!order_id || !status) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: order_id and status are required' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
        }

        // Define valid status transitions
        const validStatuses = [
            'pending',
            'confirmed',
            'preparing',
            'ready_for_pickup',
            'picked_up',
            'delivered',
            'cancelled'
        ];

        if (!validStatuses.includes(status)) {
            return new Response(
                JSON.stringify({ error: `Invalid status. Valid statuses are: ${validStatuses.join(', ')}` }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
        }

        // Check if user has permission to update this order
        // For vendors: They can update orders for their restaurant
        // For delivery persons: They can update orders assigned to them
        // For customers: They can only cancel orders in pending status

        const { data: order, error: orderError } = await supabaseClient
            .from('orders')
            .select(`
        *,
        vendor:vendors(owner_id),
        delivery_person:users(id)
      `)
            .eq('id', order_id)
            .single();

        if (orderError) {
            return new Response(
                JSON.stringify({ error: orderError.message }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            );
        }

        if (!order) {
            return new Response(
                JSON.stringify({ error: 'Order not found' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
            );
        }

        // Check permissions based on user role
        const userRole = session.user.role || 'customer';
        let hasPermission = false;

        switch (userRole) {
            case 'admin':
                // Admins can update any order
                hasPermission = true;
                break;
            case 'vendor':
                // Vendors can update orders for their restaurant
                if (order.vendor.owner_id === session.user.id) {
                    hasPermission = true;
                }
                break;
            case 'delivery_person':
                // Delivery persons can update orders assigned to them
                if (order.delivery_person_id === session.user.id) {
                    hasPermission = true;
                }
                break;
            case 'customer':
                // Customers can only cancel orders in pending status
                if (status === 'cancelled' && order.status === 'pending' && order.customer_id === session.user.id) {
                    hasPermission = true;
                }
                break;
            default:
                hasPermission = false;
        }

        if (!hasPermission) {
            return new Response(
                JSON.stringify({ error: 'Insufficient permissions to update this order' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
            );
        }

        // Update the order status
        const { data: updatedOrder, error: updateError } = await supabaseClient
            .from('orders')
            .update({
                status,
                // Set timestamps for specific statuses
                ...(status === 'picked_up' && { actual_delivery_time: new Date().toISOString() })
            })
            .eq('id', order_id)
            .select()
            .single();

        if (updateError) {
            return new Response(
                JSON.stringify({ error: updateError.message }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            );
        }

        // Return the updated order
        return new Response(
            JSON.stringify({ order: updatedOrder }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );

    } catch (error) {
        console.error('Unexpected error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
    }
});