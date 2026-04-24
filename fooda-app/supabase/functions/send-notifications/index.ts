import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type NotificationType = 'order_created' | 'order_status_update' | 'payment_received' | 'delivery_assigned' | 'custom';

interface NotificationRequest {
    type: NotificationType;
    recipient_type: 'customer' | 'vendor' | 'delivery_person' | 'admin';
    recipient_id?: string;
    order_id?: string;
    title?: string;
    message?: string;
    channels?: ('email' | 'sms' | 'push')[];
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
        const twilioAuthToken  = Deno.env.get('TWILIO_AUTH_TOKEN');
        const twilioPhone      = Deno.env.get('TWILIO_PHONE_NUMBER');
        const sendgridApiKey   = Deno.env.get('SENDGRID_API_KEY');

        const notifReq = await req.json() as NotificationRequest;
        const { type, recipient_type, recipient_id, order_id, title, message, channels = ['push'] } = notifReq;

        if (!type) {
            return new Response(JSON.stringify({ error: 'Missing notification type' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        let notifTitle   = title  || '';
        let notifMessage = message || '';
        let recipientEmail = '';
        let recipientPhone = '';
        let recipientName  = '';
        let resolvedUserId = recipient_id || null;

        // Fetch order data if needed
        let order: any = null;
        if (order_id) {
            const { data } = await supabase
                .from('orders')
                .select(`
                    id, order_number, status, total_amount, customer_id, vendor_id,
                    customer:users!orders_customer_id_fkey(id, email, phone, full_name),
                    vendor:vendors(id, email, phone, name),
                    delivery_person:users!orders_delivery_person_id_fkey(id, email, phone, full_name)
                `)
                .eq('id', order_id)
                .single();
            order = data;
        }

        // Build notification content per type
        switch (type) {
            case 'order_created':
                if (order) {
                    if (recipient_type === 'customer') {
                        notifTitle   = 'Order Placed!';
                        notifMessage = `Your order #${order.order_number} has been placed. Awaiting confirmation.`;
                        recipientEmail = order.customer?.email || '';
                        recipientPhone = order.customer?.phone || '';
                        recipientName  = order.customer?.full_name || 'Customer';
                        resolvedUserId = order.customer_id;
                    } else if (recipient_type === 'vendor') {
                        notifTitle   = 'New Order Received!';
                        notifMessage = `New order #${order.order_number}. Total: ₦${Number(order.total_amount).toLocaleString()}.`;
                        recipientEmail = order.vendor?.email || '';
                        recipientPhone = order.vendor?.phone || '';
                        recipientName  = order.vendor?.name || 'Vendor';
                    }
                }
                break;

            case 'order_status_update': {
                const msgs: Record<string, string> = {
                    confirmed:        `Order #${order?.order_number} confirmed by the restaurant.`,
                    preparing:        `Order #${order?.order_number} is being prepared.`,
                    ready_for_pickup: `Order #${order?.order_number} is ready for pickup.`,
                    picked_up:        `Order #${order?.order_number} is on the way!`,
                    delivered:        `Order #${order?.order_number} delivered. Enjoy your meal!`,
                    cancelled:        `Order #${order?.order_number} has been cancelled.`,
                };
                notifTitle   = `Order ${(order?.status || '').replace(/_/g, ' ')}`;
                notifMessage = msgs[order?.status] || `Order status: ${order?.status}`;
                if (order && recipient_type === 'customer') {
                    recipientEmail = order.customer?.email || '';
                    recipientPhone = order.customer?.phone || '';
                    recipientName  = order.customer?.full_name || 'Customer';
                    resolvedUserId = order.customer_id;
                }
                break;
            }

            case 'payment_received':
                notifTitle   = 'Payment Received!';
                notifMessage = `Payment for order #${order?.order_number} has been confirmed.`;
                if (order) {
                    recipientEmail = order.customer?.email || '';
                    recipientPhone = order.customer?.phone || '';
                    recipientName  = order.customer?.full_name || 'Customer';
                    resolvedUserId = order.customer_id;
                }
                break;

            case 'delivery_assigned':
                notifTitle   = 'New Delivery Assignment!';
                notifMessage = `You have been assigned to deliver order #${order?.order_number}.`;
                if (order && recipient_type === 'delivery_person') {
                    recipientEmail = order.delivery_person?.email || '';
                    recipientPhone = order.delivery_person?.phone || '';
                    recipientName  = order.delivery_person?.full_name || 'Driver';
                    resolvedUserId = order.delivery_person?.id || null;
                }
                break;

            case 'custom':
                // Use provided title/message as-is
                break;
        }

        // Resolve recipient from ID if not yet populated
        if (recipient_id && !recipientEmail) {
            const { data: u } = await supabase.from('users').select('email, phone, full_name').eq('id', recipient_id).single();
            if (u) {
                recipientEmail = u.email;
                recipientPhone = u.phone || '';
                recipientName  = u.full_name || 'User';
            }
        }

        const results: { channel: string; success: boolean; message: string }[] = [];

        // Email via SendGrid
        if (channels.includes('email') && recipientEmail && sendgridApiKey) {
            try {
                const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${sendgridApiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        personalizations: [{ to: [{ email: recipientEmail, name: recipientName }] }],
                        from: { email: 'noreply@fooda.com', name: 'Fooda' },
                        subject: notifTitle,
                        content: [{
                            type: 'text/html',
                            value: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
                                <div style="background:linear-gradient(135deg,#ff6b35,#f7931e);padding:20px;text-align:center">
                                    <h1 style="color:white;margin:0">Fooda</h1>
                                </div>
                                <div style="padding:30px;background:#fff">
                                    <h2 style="color:#333">${notifTitle}</h2>
                                    <p style="color:#666;font-size:16px;line-height:1.6">${notifMessage}</p>
                                </div>
                                <div style="padding:20px;background:#f5f5f5;text-align:center">
                                    <p style="color:#999;font-size:12px">© 2025 Fooda</p>
                                </div>
                            </div>`
                        }]
                    })
                });
                results.push({ channel: 'email', success: res.ok, message: res.ok ? 'Sent' : 'Failed' });
            } catch (e: any) {
                results.push({ channel: 'email', success: false, message: e.message });
            }
        }

        // SMS via Twilio
        if (channels.includes('sms') && recipientPhone && twilioAccountSid && twilioAuthToken) {
            try {
                const res = await fetch(
                    `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: new URLSearchParams({ To: recipientPhone, From: twilioPhone || '', Body: `${notifTitle}\n${notifMessage}` })
                    }
                );
                results.push({ channel: 'sms', success: res.ok, message: res.ok ? 'Sent' : 'Failed' });
            } catch (e: any) {
                results.push({ channel: 'sms', success: false, message: e.message });
            }
        }

        // Push (logged — integrate Firebase FCM here when ready)
        if (channels.includes('push')) {
            console.log('PUSH:', { title: notifTitle, body: notifMessage, order_id, type });
            results.push({ channel: 'push', success: true, message: 'Logged' });
        }

        // Persist notification to dedicated notifications table
        if (resolvedUserId || order_id) {
            await supabase.from('notifications').insert({
                user_id: resolvedUserId,
                order_id: order_id || null,
                type,
                title: notifTitle,
                message: notifMessage,
                is_read: false
            }).catch((e: any) => console.warn('Notification persist failed:', e.message));
        }

        return new Response(JSON.stringify({ success: true, results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('send-notifications error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
