import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface NotificationRequest {
    type: 'order_created' | 'order_status_update' | 'payment_received' | 'delivery_assigned' | 'custom';
    recipient_type: 'customer' | 'vendor' | 'delivery_person' | 'admin';
    recipient_id?: string;
    order_id?: string;
    title?: string;
    message?: string;
    channels?: ('email' | 'sms' | 'push')[];
}

interface Order {
    id: string;
    order_number: string;
    status: string;
    total_amount: number;
    customer_id: string;
    vendor_id: string;
    delivery_person_id: string | null;
    customer?: { email: string; phone: string; full_name: string };
    vendor?: { email: string; phone: string; name: string };
    delivery_person?: { email: string; phone: string; full_name: string };
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        // Optional: Email/SMS service credentials
        const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
        const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
        const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
        const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const notificationReq = await req.json() as NotificationRequest;
        const { type, recipient_type, recipient_id, order_id, title, message, channels = ['push'] } = notificationReq;

        // Validate request
        if (!type) {
            return new Response(
                JSON.stringify({ error: 'Missing notification type' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        let order: Order | null = null;
        let notificationTitle = title || '';
        let notificationMessage = message || '';
        let recipientEmail = '';
        let recipientPhone = '';
        let recipientName = '';

        // Fetch order details if order_id provided
        if (order_id) {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    customer:users!orders_customer_id_fkey(id, email, phone, full_name),
                    vendor:vendors(id, email, phone, name),
                    delivery_person:users!orders_delivery_person_id_fkey(id, email, phone, full_name)
                `)
                .eq('id', order_id)
                .single();

            if (error || !data) {
                console.error('Order not found:', error);
            } else {
                order = data as unknown as Order;
            }
        }

        // Generate notification content based on type
        switch (type) {
            case 'order_created':
                if (order) {
                    if (recipient_type === 'customer') {
                        notificationTitle = 'Order Placed Successfully! 🎉';
                        notificationMessage = `Your order #${order.order_number} has been placed. We'll notify you when the restaurant confirms it.`;
                        recipientEmail = order.customer?.email || '';
                        recipientPhone = order.customer?.phone || '';
                        recipientName = order.customer?.full_name || 'Customer';
                    } else if (recipient_type === 'vendor') {
                        notificationTitle = 'New Order Received! 📦';
                        notificationMessage = `You have a new order #${order.order_number}. Total: $${order.total_amount.toFixed(2)}. Please confirm it.`;
                        recipientEmail = order.vendor?.email || '';
                        recipientPhone = order.vendor?.phone || '';
                        recipientName = order.vendor?.name || 'Vendor';
                    }
                }
                break;

            case 'order_status_update':
                if (order) {
                    const statusMessages: Record<string, { title: string; message: string }> = {
                        confirmed: {
                            title: 'Order Confirmed! ✅',
                            message: `Your order #${order.order_number} has been confirmed by the restaurant. They're getting it ready!`
                        },
                        preparing: {
                            title: 'Order Being Prepared 👨‍🍳',
                            message: `The restaurant is now preparing your order #${order.order_number}.`
                        },
                        ready_for_pickup: {
                            title: 'Order Ready! 🍔',
                            message: `Your order #${order.order_number} is ready and waiting for pickup by a delivery partner.`
                        },
                        picked_up: {
                            title: 'Order On The Way! 🚴',
                            message: `Your order #${order.order_number} has been picked up and is on its way to you!`
                        },
                        delivered: {
                            title: 'Order Delivered! 🎉',
                            message: `Your order #${order.order_number} has been delivered. Enjoy your meal!`
                        },
                        cancelled: {
                            title: 'Order Cancelled ❌',
                            message: `Your order #${order.order_number} has been cancelled. If you were charged, a refund will be processed.`
                        }
                    };

                    const statusInfo = statusMessages[order.status] || {
                        title: 'Order Update',
                        message: `Your order #${order.order_number} status has been updated to: ${order.status}`
                    };

                    notificationTitle = statusInfo.title;
                    notificationMessage = statusInfo.message;

                    if (recipient_type === 'customer') {
                        recipientEmail = order.customer?.email || '';
                        recipientPhone = order.customer?.phone || '';
                        recipientName = order.customer?.full_name || 'Customer';
                    }
                }
                break;

            case 'payment_received':
                if (order) {
                    notificationTitle = 'Payment Received! 💳';
                    notificationMessage = `We've received payment for order #${order.order_number}. Thank you!`;
                    recipientEmail = order.customer?.email || '';
                    recipientPhone = order.customer?.phone || '';
                    recipientName = order.customer?.full_name || 'Customer';
                }
                break;

            case 'delivery_assigned':
                if (order && recipient_type === 'delivery_person') {
                    notificationTitle = 'New Delivery Assignment! 🚴';
                    notificationMessage = `You've been assigned to deliver order #${order.order_number}. Pickup from ${order.vendor?.name}.`;
                    recipientEmail = order.delivery_person?.email || '';
                    recipientPhone = order.delivery_person?.phone || '';
                    recipientName = order.delivery_person?.full_name || 'Driver';
                }
                break;

            case 'custom':
                // Use provided title and message
                break;
        }

        // Fetch recipient info if not from order
        if (recipient_id && !recipientEmail) {
            const { data: user } = await supabase
                .from('users')
                .select('email, phone, full_name')
                .eq('id', recipient_id)
                .single();

            if (user) {
                recipientEmail = user.email;
                recipientPhone = user.phone || '';
                recipientName = user.full_name || 'User';
            }
        }

        const results: { channel: string; success: boolean; message: string }[] = [];

        // Send Email (using SendGrid if configured)
        if (channels.includes('email') && recipientEmail && sendgridApiKey) {
            try {
                const emailResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${sendgridApiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        personalizations: [{
                            to: [{ email: recipientEmail, name: recipientName }],
                        }],
                        from: { email: 'noreply@fooda.com', name: 'Fooda' },
                        subject: notificationTitle,
                        content: [{
                            type: 'text/html',
                            value: `
                                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                    <div style="background: linear-gradient(135deg, #ff6b35, #f7931e); padding: 20px; text-align: center;">
                                        <h1 style="color: white; margin: 0;">Fooda</h1>
                                    </div>
                                    <div style="padding: 30px; background: #fff;">
                                        <h2 style="color: #333;">${notificationTitle}</h2>
                                        <p style="color: #666; font-size: 16px; line-height: 1.6;">${notificationMessage}</p>
                                    </div>
                                    <div style="padding: 20px; background: #f5f5f5; text-align: center;">
                                        <p style="color: #999; font-size: 12px;">© 2025 Fooda. All rights reserved.</p>
                                    </div>
                                </div>
                            `
                        }]
                    }),
                });

                results.push({
                    channel: 'email',
                    success: emailResponse.ok,
                    message: emailResponse.ok ? 'Email sent successfully' : 'Email sending failed'
                });
            } catch (err) {
                console.error('Email error:', err);
                results.push({ channel: 'email', success: false, message: err.message });
            }
        }

        // Send SMS (using Twilio if configured)
        if (channels.includes('sms') && recipientPhone && twilioAccountSid && twilioAuthToken) {
            try {
                const smsResponse = await fetch(
                    `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: new URLSearchParams({
                            To: recipientPhone,
                            From: twilioPhoneNumber || '',
                            Body: `${notificationTitle}\n\n${notificationMessage}`
                        }),
                    }
                );

                results.push({
                    channel: 'sms',
                    success: smsResponse.ok,
                    message: smsResponse.ok ? 'SMS sent successfully' : 'SMS sending failed'
                });
            } catch (err) {
                console.error('SMS error:', err);
                results.push({ channel: 'sms', success: false, message: err.message });
            }
        }

        // Push notification (log for now, implement with Firebase in production)
        if (channels.includes('push')) {
            console.log(`PUSH NOTIFICATION to ${recipientName}:`, {
                title: notificationTitle,
                body: notificationMessage,
                data: { order_id, type }
            });
            results.push({
                channel: 'push',
                success: true,
                message: 'Push notification logged (implement Firebase for production)'
            });
        }

        // Log notification to database for history
        await supabase
            .from('wallet_transactions') // Reusing for notifications log (or create a notifications table)
            .insert({
                user_id: recipient_id || (order?.customer_id),
                order_id: order_id,
                transaction_type: 'credit', // Just for logging
                amount: 0,
                balance_after: 0,
                description: `[NOTIFICATION] ${notificationTitle}: ${notificationMessage}`
            });

        return new Response(
            JSON.stringify({
                success: true,
                notification: {
                    title: notificationTitle,
                    message: notificationMessage,
                    recipient: recipientName,
                },
                results
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Notification error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
