import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/utils.ts";

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready_for_pickup' | 'picked_up' | 'delivered' | 'cancelled';

// Only these transitions are allowed (from → to[])
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    pending:           ['confirmed', 'cancelled'],
    confirmed:         ['preparing', 'cancelled'],
    preparing:         ['ready_for_pickup', 'cancelled'],
    ready_for_pickup:  ['picked_up'],
    picked_up:         ['delivered'],
    delivered:         [],
    cancelled:         [],
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Auth client (verify caller)
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const { order_id, new_status } = await req.json();
        if (!order_id || !new_status) {
            return new Response(JSON.stringify({ error: 'order_id and new_status are required' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Fetch the order with vendor info
        const { data: order, error: fetchError } = await supabaseAdmin
            .from('orders')
            .select('id, order_number, status, customer_id, vendor_id, vendors!orders_vendor_id_fkey(owner_id)')
            .eq('id', order_id)
            .single();

        if (fetchError || !order) {
            return new Response(JSON.stringify({ error: 'Order not found' }), {
                status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Authorisation: only vendor owner or admin can update
        const { data: caller } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();

        const isAdmin = caller?.role === 'admin';
        const isVendorOwner = (order.vendors as any)?.owner_id === user.id;

        if (!isAdmin && !isVendorOwner) {
            return new Response(JSON.stringify({ error: 'Forbidden: not your order' }), {
                status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const currentStatus = order.status as OrderStatus;
        const targetStatus = new_status as OrderStatus;

        // Validate transition
        if (!ALLOWED_TRANSITIONS[currentStatus]?.includes(targetStatus)) {
            return new Response(JSON.stringify({
                error: `Invalid transition: ${currentStatus} → ${targetStatus}`,
                allowed: ALLOWED_TRANSITIONS[currentStatus]
            }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Update the order
        const { error: updateError } = await supabaseAdmin
            .from('orders')
            .update({ status: targetStatus })
            .eq('id', order_id);

        if (updateError) throw updateError;

        // Notify customer
        const statusMessages: Record<string, string> = {
            confirmed:        `Your order #${order.order_number} has been confirmed.`,
            preparing:        `Your order #${order.order_number} is being prepared.`,
            ready_for_pickup: `Your order #${order.order_number} is ready for pickup.`,
            picked_up:        `Your order #${order.order_number} is on the way!`,
            delivered:        `Your order #${order.order_number} has been delivered. Enjoy!`,
            cancelled:        `Your order #${order.order_number} has been cancelled.`,
        };

        if (order.customer_id && statusMessages[targetStatus]) {
            await supabaseAdmin.from('notifications').insert({
                user_id: order.customer_id,
                order_id,
                type: 'order_status_update',
                title: `Order ${targetStatus.replace(/_/g, ' ')}`,
                message: statusMessages[targetStatus],
                is_read: false
            }).catch((e: any) => console.warn('Notification insert failed:', e.message));
        }

        return new Response(JSON.stringify({
            success: true,
            order_id,
            previous_status: currentStatus,
            new_status: targetStatus
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('update-order-status error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
