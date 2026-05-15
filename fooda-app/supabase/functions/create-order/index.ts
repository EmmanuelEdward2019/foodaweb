import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { corsHeaders, generateOrderNumber, calculateOrderTotals } from "../_shared/utils.ts";

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Use anon key + auth header so RLS applies to the customer
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );

        // Service-role client for operations that bypass RLS (reads platform settings, etc.)
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

        const body = await req.json();
        const { vendor_id, delivery_address, items, notes, payment_method } = body;

        if (!vendor_id || !delivery_address || !Array.isArray(items) || items.length === 0) {
            return new Response(JSON.stringify({ error: 'vendor_id, delivery_address, and items are required' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Allow cash on delivery or default to card. Anything else from the
        // client is ignored — we never trust a client-supplied 'completed'
        // payment status. Values must match the orders.payment_method CHECK
        // constraint: ('cash','card','paypal','wallet').
        const safePaymentMethod = payment_method === 'cash_on_delivery' ? 'cash' : 'card';

        // Validate item structure
        for (const item of items) {
            if (!item.menu_item_id || !item.quantity || item.quantity < 1) {
                return new Response(JSON.stringify({ error: 'Each item needs menu_item_id and quantity >= 1' }), {
                    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // Fetch actual menu item prices from DB (prevents price manipulation from client)
        const menuItemIds = items.map((i: any) => i.menu_item_id);
        const { data: dbItems, error: itemsError } = await supabaseAdmin
            .from('menu_items')
            .select('id, name, price, is_available, vendor_id')
            .in('id', menuItemIds);

        if (itemsError || !dbItems) {
            return new Response(JSON.stringify({ error: 'Failed to fetch menu items' }), {
                status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Validate all items exist, belong to this vendor, and are available
        for (const reqItem of items) {
            const dbItem = dbItems.find((d: any) => d.id === reqItem.menu_item_id);
            if (!dbItem) {
                return new Response(JSON.stringify({ error: `Menu item not found: ${reqItem.menu_item_id}` }), {
                    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
            if (dbItem.vendor_id !== vendor_id) {
                return new Response(JSON.stringify({ error: `Item ${dbItem.name} does not belong to this vendor` }), {
                    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
            if (!dbItem.is_available) {
                return new Response(JSON.stringify({ error: `${dbItem.name} is currently unavailable` }), {
                    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // Fetch platform settings for tax rate and delivery fee
        const { data: settings } = await supabaseAdmin
            .from('platform_settings')
            .select('setting_key, setting_value')
            .in('setting_key', ['tax_rate', 'delivery_fee', 'min_order_amount']);

        const getSettingNumber = (key: string, fallback: number): number => {
            const found = settings?.find((s: any) => s.setting_key === key);
            return found ? parseFloat(found.setting_value) : fallback;
        };

        const taxRatePct = getSettingNumber('tax_rate', 7.5);
        const taxRate = taxRatePct / 100;
        const platformDeliveryFee = getSettingNumber('delivery_fee', 500);
        const minOrderAmount = getSettingNumber('min_order_amount', 1000);

        // Build validated items using DB prices
        const validatedItems = items.map((reqItem: any) => {
            const dbItem = dbItems.find((d: any) => d.id === reqItem.menu_item_id)!;
            return {
                menu_item_id: reqItem.menu_item_id,
                quantity: reqItem.quantity,
                price: Number(dbItem.price),
                special_instructions: reqItem.special_instructions || null,
            };
        });

        const totals = calculateOrderTotals(validatedItems, platformDeliveryFee, taxRate);

        if (totals.subtotal < minOrderAmount) {
            return new Response(JSON.stringify({
                error: `Minimum order amount is ₦${minOrderAmount.toLocaleString()}`
            }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const order_number = generateOrderNumber();

        // Insert order
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .insert({
                customer_id: user.id,
                vendor_id,
                order_number,
                delivery_address,
                delivery_fee: totals.deliveryFee,
                subtotal: totals.subtotal,
                tax_amount: totals.taxAmount,
                total_amount: totals.totalAmount,
                notes: notes || null,
                status: 'pending',
                payment_status: 'pending',
                payment_method: safePaymentMethod,
            })
            .select()
            .single();

        if (orderError) {
            console.error('Order insert error:', orderError);
            return new Response(JSON.stringify({
                error: orderError.message,
                where: 'orders.insert',
                code: orderError.code,
                details: orderError.details,
                hint: orderError.hint,
            }), {
                status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Insert order items using DB prices
        const orderItems = validatedItems.map((item) => ({
            order_id: order.id,
            menu_item_id: item.menu_item_id,
            quantity: item.quantity,
            price_per_unit: item.price,
            total_price: Number((item.price * item.quantity).toFixed(2)),
            special_instructions: item.special_instructions,
        }));

        const { error: itemsInsertError } = await supabaseAdmin
            .from('order_items')
            .insert(orderItems);

        if (itemsInsertError) {
            // Rollback order
            await supabaseAdmin.from('orders').delete().eq('id', order.id);
            return new Response(JSON.stringify({
                error: itemsInsertError.message,
                where: 'order_items.insert',
                code: itemsInsertError.code,
                details: itemsInsertError.details,
                hint: itemsInsertError.hint,
            }), {
                status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Notify vendor of new order. Failure here must not block the order
        // (the order itself is already committed). In supabase-js v2.89+ the
        // un-awaited builder no longer exposes .catch(), so we use try/catch.
        try {
            const { error: notifyError } = await supabaseAdmin.from('notifications').insert({
                user_id: null,
                vendor_id,
                order_id: order.id,
                type: 'order_created',
                title: 'New Order',
                message: `New order #${order_number} received. Total: ₦${totals.totalAmount.toLocaleString()}`,
                is_read: false,
            });
            if (notifyError) console.warn('Notification insert failed:', notifyError.message);
        } catch (e) {
            console.warn('Notification insert threw:', (e as Error).message);
        }

        return new Response(JSON.stringify({ order }), {
            status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('create-order error:', error);
        return new Response(JSON.stringify({
            error: (error as Error).message,
            stack: (error as Error).stack?.split('\n').slice(0, 5).join('\n'),
        }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
