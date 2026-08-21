// Every transactional email Fooda sends, as a typed template function.
//
// Each template returns { subject, html, text } — never send HTML without the
// text alternative, it materially affects spam scoring.
//
// Field names mirror the database (order_number, total_amount, ...) so call
// sites can pass rows through with minimal reshaping.

import {
    alertBox,
    amountBlock,
    brand,
    button,
    colors,
    divider,
    esc,
    fallbackLink,
    formatCurrency,
    formatDateTime,
    htmlToText,
    infoPanel,
    orderItemsTable,
    paragraph,
    renderEmail,
    statusTracker,
    subheading,
} from './layout.ts';
import type {
    EmailOrderItem,
    EmailOrderTotals,
    InfoRow,
    LayoutOptions,
} from './layout.ts';

export interface RenderedEmail {
    subject: string;
    html: string;
    text: string;
}

/** Wrap content in the shell and derive the plain-text part. */
const compose = (subject: string, options: LayoutOptions): RenderedEmail => {
    const html = renderEmail(options);
    return { subject, html, text: htmlToText(html) };
};

const greeting = (name?: string): string =>
    paragraph(`Hi ${esc((name || '').split(' ')[0] || 'there')},`);

const orderUrl = (orderId: string) => `${brand.url}/orders/${orderId}`;
const trackUrl = (orderId: string) => `${brand.url}/track/${orderId}`;

/* ================================================================== *
 * 1. ACCOUNT & AUTHENTICATION
 * ================================================================== */

export interface VerifyEmailData {
    name?: string;
    confirmationUrl: string;
    /** Hours until the link expires. Supabase defaults to 24. */
    expiresInHours?: number;
}

/** Sign-up confirmation. Also mirrored as a Supabase Auth template. */
export const verifyEmail = (data: VerifyEmailData): RenderedEmail =>
    compose(`Confirm your ${brand.name} account`, {
        preheader: `One click to confirm your email and start ordering on ${brand.name}.`,
        heroBadge: 'Verify your email',
        heroTitle: `Welcome to ${brand.name}`,
        heroSubtitle: 'Confirm your email address to activate your account.',
        content: `
            ${greeting(data.name)}
            ${paragraph(`Thanks for signing up. Please confirm your email address so we can secure your account and get you ordering.`)}
            ${button('Confirm my email', data.confirmationUrl)}
            ${fallbackLink(data.confirmationUrl)}
            ${alertBox('info', 'This link expires', `For your security, the confirmation link is valid for ${data.expiresInHours ?? 24} hours. You can request a new one from the sign-in page at any time.`)}
            ${paragraph(`If you didn't create a ${brand.name} account, you can safely ignore this email — no account will be activated.`)}
        `,
        footerNote: `You received this email because an account was created with this address on ${brand.name}.`,
    });

export interface WelcomeData {
    name?: string;
    /** 'customer' | 'vendor' | 'delivery_person' */
    role?: string;
    ctaUrl?: string;
}

/** Sent once the account is confirmed. */
export const welcome = (data: WelcomeData): RenderedEmail => {
    const role = data.role || 'customer';
    const copy: Record<string, { title: string; intro: string; cta: string; steps: string[] }> = {
        customer: {
            title: `You're all set, welcome to ${brand.name}`,
            intro: 'Your account is active. Thousands of meals from restaurants near you are a few taps away.',
            cta: 'Browse restaurants',
            steps: [
                'Add your delivery address so we can show what is available near you.',
                'Browse restaurants and build your order.',
                'Pay securely online and track your rider in real time.',
            ],
        },
        vendor: {
            title: `Welcome aboard, partner`,
            intro: 'Your restaurant account is active. Set up your menu and start receiving orders.',
            cta: 'Open vendor dashboard',
            steps: [
                'Complete your restaurant profile, business hours and delivery area.',
                'Add your menu categories, items and add-ons.',
                'Switch your storefront to open and start accepting orders.',
            ],
        },
        delivery_person: {
            title: `Welcome to the ${brand.name} rider network`,
            intro: 'Your rider account is active. Go online to start receiving delivery assignments.',
            cta: 'Open rider dashboard',
            steps: [
                'Complete your profile and upload your vehicle details.',
                'Set your availability so we can assign deliveries near you.',
                'Accept your first delivery and get paid per completed trip.',
            ],
        },
    };
    const c = copy[role] || copy.customer;
    const steps = c.steps
        .map(
            (step, i) => `
        <tr>
          <td width="30" valign="top" style="padding:6px 12px 6px 0;">
            <div style="width:24px;height:24px;line-height:24px;text-align:center;border-radius:50%;background:${colors.yellowTint};border:1px solid #fde68a;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:${colors.warning};">${i + 1}</div>
          </td>
          <td valign="top" style="padding:6px 0;font-family:Arial,sans-serif;font-size:15px;line-height:24px;color:${colors.body};">${esc(step)}</td>
        </tr>`,
        )
        .join('');

    return compose(c.title, {
        preheader: c.intro,
        heroBadge: 'Account activated',
        heroTitle: c.title,
        content: `
            ${greeting(data.name)}
            ${paragraph(esc(c.intro))}
            ${subheading('Getting started')}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">${steps}</table>
            ${button(c.cta, data.ctaUrl || brand.url)}
        `,
        footerNote: `You received this email because you created a ${brand.name} account.`,
    });
};

export interface PasswordResetData {
    name?: string;
    resetUrl: string;
    expiresInMinutes?: number;
    requestedFrom?: string;
    /**
     * When the reset was requested. Omit for the static Supabase Auth template —
     * a baked-in timestamp would be wrong for every future send.
     */
    requestedAt?: string | Date;
}

/** Forgot password. Also mirrored as a Supabase Auth template. */
export const passwordReset = (data: PasswordResetData): RenderedEmail =>
    compose(`Reset your ${brand.name} password`, {
        preheader: `Use this secure link to choose a new ${brand.name} password.`,
        heroBadge: 'Password reset',
        heroTitle: 'Reset your password',
        heroSubtitle: 'Choose a new password using the secure link below.',
        content: `
            ${greeting(data.name)}
            ${paragraph(`We received a request to reset the password for your ${brand.name} account. Click the button below to choose a new one.`)}
            ${button('Reset my password', data.resetUrl)}
            ${fallbackLink(data.resetUrl)}
            ${infoPanel([
                { label: 'Link valid for', value: `${data.expiresInMinutes ?? 60} minutes` },
                { label: 'Requested from', value: data.requestedFrom || '' },
                { label: 'Requested at', value: data.requestedAt ? formatDateTime(data.requestedAt) : '' },
            ])}
            ${alertBox('warning', "Didn't request this?", 'You can safely ignore this email — your password stays unchanged. If you receive these repeatedly, please contact our support team.')}
        `,
        footerNote: 'For your security, never share this link with anyone. Fooda staff will never ask you for it.',
    });

export interface PasswordChangedData {
    name?: string;
    changedAt?: string | Date;
    device?: string;
}

/** Confirmation that a password was actually changed. */
export const passwordChanged = (data: PasswordChangedData): RenderedEmail =>
    compose('Your password was changed', {
        preheader: `The password on your ${brand.name} account was just changed.`,
        heroBadge: 'Security notice',
        heroTitle: 'Your password was changed',
        content: `
            ${greeting(data.name)}
            ${paragraph(`The password for your ${brand.name} account was changed successfully. No further action is needed if this was you.`)}
            ${infoPanel([
                { label: 'Changed at', value: formatDateTime(data.changedAt || new Date()) },
                { label: 'Device', value: data.device || 'Unknown device' },
            ])}
            ${alertBox('danger', "Wasn't you?", `Reset your password immediately and contact us at ${brand.supportEmail}. Someone else may have access to your account.`)}
            ${button('Secure my account', `${brand.url}/auth/reset-password`, 'ghost')}
        `,
        footerNote: 'This is a security notification and cannot be unsubscribed from.',
    });

/* ================================================================== *
 * 2. ORDERS — CUSTOMER
 * ================================================================== */

export interface OrderEmailBase {
    customerName?: string;
    orderId: string;
    orderNumber: string;
    vendorName: string;
    items?: EmailOrderItem[];
    totals?: EmailOrderTotals;
    deliveryAddress?: string;
    placedAt?: string | Date;
    estimatedDelivery?: string | Date;
    paymentMethod?: string;
    notes?: string;
}

const orderMetaRows = (data: OrderEmailBase): InfoRow[] => [
    { label: 'Order number', value: data.orderNumber, emphasis: true },
    { label: 'Restaurant', value: data.vendorName },
    { label: 'Placed', value: data.placedAt ? formatDateTime(data.placedAt) : '' },
    { label: 'Payment method', value: data.paymentMethod ? data.paymentMethod.toUpperCase() : '' },
    { label: 'Deliver to', value: data.deliveryAddress || '' },
];

/** Order received — sent the moment the order is created. */
export const orderPlaced = (data: OrderEmailBase): RenderedEmail =>
    compose(`Order ${data.orderNumber} received`, {
        preheader: `We've sent your order to ${data.vendorName}. We'll confirm as soon as they accept it.`,
        heroBadge: data.orderNumber,
        heroTitle: 'We received your order',
        heroSubtitle: `${data.vendorName} is reviewing it now — you'll get a confirmation shortly.`,
        content: `
            ${greeting(data.customerName)}
            ${paragraph(`Thanks for ordering with ${brand.name}. Here's a summary of what you ordered.`)}
            ${statusTracker('pending')}
            ${infoPanel(orderMetaRows(data))}
            ${subheading('Order summary')}
            ${data.items ? orderItemsTable(data.items, data.totals) : ''}
            ${data.notes ? alertBox('info', 'Your note to the restaurant', data.notes) : ''}
            ${button('Track my order', trackUrl(data.orderId))}
        `,
        footerNote: `You received this email because you placed an order on ${brand.name}.`,
    });

export interface OrderStatusData extends OrderEmailBase {
    /** orders.status value */
    status: string;
    estimatedPrepTime?: number;
}

/** Confirmed / preparing / ready — one template, status-aware copy. */
export const orderStatusUpdate = (data: OrderStatusData): RenderedEmail => {
    const copy: Record<string, { subject: string; title: string; sub: string; body: string }> = {
        confirmed: {
            subject: `Order ${data.orderNumber} confirmed`,
            title: 'Your order is confirmed',
            sub: `${data.vendorName} has accepted your order.`,
            body: `Good news — ${esc(data.vendorName)} accepted your order and will start preparing it shortly.`,
        },
        preparing: {
            subject: `Order ${data.orderNumber} is being prepared`,
            title: 'Your food is being prepared',
            sub: `${data.vendorName} is cooking your order now.`,
            body: `${esc(data.vendorName)} is preparing your meal right now. We'll let you know the moment it's handed to a rider.`,
        },
        ready_for_pickup: {
            subject: `Order ${data.orderNumber} is ready`,
            title: 'Your order is ready',
            sub: 'A rider is being assigned to collect it.',
            body: `Your order is packed and waiting at ${esc(data.vendorName)}. A rider is on the way to collect it.`,
        },
    };
    const c = copy[data.status] || copy.confirmed;

    return compose(c.subject, {
        preheader: c.sub,
        heroBadge: data.orderNumber,
        heroTitle: c.title,
        heroSubtitle: c.sub,
        content: `
            ${greeting(data.customerName)}
            ${paragraph(c.body)}
            ${statusTracker(data.status)}
            ${infoPanel([
                { label: 'Order number', value: data.orderNumber, emphasis: true },
                { label: 'Restaurant', value: data.vendorName },
                { label: 'Estimated prep time', value: data.estimatedPrepTime ? `${data.estimatedPrepTime} minutes` : '' },
                { label: 'Estimated delivery', value: data.estimatedDelivery ? formatDateTime(data.estimatedDelivery) : '' },
                { label: 'Deliver to', value: data.deliveryAddress || '' },
            ])}
            ${button('Track my order', trackUrl(data.orderId))}
        `,
        footerNote: `You received this email because of activity on order ${data.orderNumber}.`,
    });
};

export interface OutForDeliveryData extends OrderEmailBase {
    riderName?: string;
    riderPhone?: string;
    vehicle?: string;
}

/** Picked up — the rider is en route. */
export const orderOutForDelivery = (data: OutForDeliveryData): RenderedEmail =>
    compose(`Order ${data.orderNumber} is on the way`, {
        preheader: `${data.riderName || 'Your rider'} has picked up your order and is heading to you.`,
        heroBadge: data.orderNumber,
        heroTitle: 'Your order is on the way',
        heroSubtitle: `${data.riderName || 'Your rider'} has collected your order from ${data.vendorName}.`,
        content: `
            ${greeting(data.customerName)}
            ${paragraph('Your food has left the restaurant and is heading your way. You can follow the rider live from your order page.')}
            ${statusTracker('picked_up')}
            ${infoPanel([
                { label: 'Rider', value: data.riderName || 'Assigned rider' },
                { label: 'Contact', value: data.riderPhone || '' },
                { label: 'Vehicle', value: data.vehicle || '' },
                { label: 'Estimated arrival', value: data.estimatedDelivery ? formatDateTime(data.estimatedDelivery) : '' },
                { label: 'Delivering to', value: data.deliveryAddress || '' },
            ])}
            ${button('Track live', trackUrl(data.orderId))}
            ${paragraph(`<span style="color:${colors.muted};font-size:14px;">Please keep your phone reachable so the rider can find you quickly.</span>`)}
        `,
        footerNote: `You received this email because of activity on order ${data.orderNumber}.`,
    });

export interface OrderDeliveredData extends OrderEmailBase {
    deliveredAt?: string | Date;
    riderName?: string;
    reviewUrl?: string;
}

/** Delivered — receipt recap plus a review nudge. */
export const orderDelivered = (data: OrderDeliveredData): RenderedEmail =>
    compose(`Order ${data.orderNumber} delivered — enjoy your meal`, {
        preheader: `Your order from ${data.vendorName} has been delivered. Enjoy!`,
        heroBadge: data.orderNumber,
        heroTitle: 'Delivered — enjoy your meal',
        heroSubtitle: `Your order from ${data.vendorName} has arrived.`,
        content: `
            ${greeting(data.customerName)}
            ${paragraph(`Your order was delivered${data.deliveredAt ? ` at <strong style="color:${colors.ink};">${esc(formatDateTime(data.deliveredAt))}</strong>` : ''}. We hope it's exactly what you wanted.`)}
            ${statusTracker('delivered')}
            ${data.items ? `${subheading('What you ordered')}${orderItemsTable(data.items, data.totals)}` : ''}
            ${subheading('How did we do?')}
            ${paragraph(`A quick rating helps ${esc(data.vendorName)}${data.riderName ? ` and ${esc(data.riderName)}` : ''} — and helps other customers order with confidence.`)}
            ${button('Rate this order', data.reviewUrl || `${brand.url}/orders/${data.orderId}/review`)}
        `,
        footerNote: `You received this email because order ${data.orderNumber} was completed.`,
    });

export interface OrderCancelledData extends OrderEmailBase {
    reason?: string;
    cancelledBy?: 'customer' | 'vendor' | 'admin' | 'system';
    refundAmount?: number;
    refundEta?: string;
}

/** Cancellation, with refund expectations set clearly. */
export const orderCancelled = (data: OrderCancelledData): RenderedEmail => {
    const by = data.cancelledBy || 'vendor';
    const byCopy: Record<string, string> = {
        customer: 'You cancelled this order.',
        vendor: `${data.vendorName} could not fulfil this order.`,
        admin: `Our team cancelled this order.`,
        system: 'This order was cancelled automatically.',
    };

    return compose(`Order ${data.orderNumber} was cancelled`, {
        preheader: `Order ${data.orderNumber} has been cancelled${data.refundAmount ? ' and your refund is on the way' : ''}.`,
        heroBadge: data.orderNumber,
        heroTitle: 'Your order was cancelled',
        heroSubtitle: byCopy[by],
        content: `
            ${greeting(data.customerName)}
            ${paragraph(`We're sorry — order <strong style="color:${colors.ink};">${esc(data.orderNumber)}</strong> from ${esc(data.vendorName)} has been cancelled.`)}
            ${data.reason ? alertBox('warning', 'Reason given', data.reason) : ''}
            ${
                data.refundAmount
                    ? `${amountBlock('Refund amount', data.refundAmount, data.refundEta || 'Refunds typically settle within 5–10 business days.')}`
                    : paragraph('You have not been charged for this order.')
            }
            ${infoPanel(orderMetaRows(data))}
            ${button('Order something else', `${brand.url}/restaurants`)}
        `,
        footerNote: `You received this email because order ${data.orderNumber} was cancelled.`,
    });
};

/* ================================================================== *
 * 3. PAYMENTS
 * ================================================================== */

export interface PaymentReceiptData extends OrderEmailBase {
    amount: number;
    reference: string;
    paidAt?: string | Date;
    /** Last 4 digits, bank name, "Paystack", etc. */
    paymentChannel?: string;
}

/** Payment successful — the customer's receipt. */
export const paymentReceipt = (data: PaymentReceiptData): RenderedEmail =>
    compose(`Payment received for order ${data.orderNumber}`, {
        preheader: `We've received your payment of ${formatCurrency(data.amount)} for order ${data.orderNumber}.`,
        heroBadge: 'Payment receipt',
        heroTitle: 'Payment received',
        heroSubtitle: `Thank you — your payment for order ${data.orderNumber} was successful.`,
        content: `
            ${greeting(data.customerName)}
            ${paragraph('This is your receipt. Keep it for your records — no action is needed.')}
            ${amountBlock('Amount paid', data.amount)}
            ${infoPanel([
                { label: 'Order number', value: data.orderNumber, emphasis: true },
                { label: 'Restaurant', value: data.vendorName },
                { label: 'Payment reference', value: data.reference },
                { label: 'Paid via', value: data.paymentChannel || 'Paystack' },
                { label: 'Paid at', value: formatDateTime(data.paidAt || new Date()) },
            ])}
            ${data.items ? `${subheading('Order summary')}${orderItemsTable(data.items, data.totals)}` : ''}
            ${button('View order', orderUrl(data.orderId))}
        `,
        footerNote: 'This receipt was issued automatically for a completed payment on your account.',
    });

export interface PaymentFailedData extends OrderEmailBase {
    amount: number;
    reference?: string;
    reason?: string;
    retryUrl?: string;
}

/** Payment failed — recoverable, with a single obvious next step. */
export const paymentFailed = (data: PaymentFailedData): RenderedEmail =>
    compose(`Payment failed for order ${data.orderNumber}`, {
        preheader: `We couldn't process your payment of ${formatCurrency(data.amount)}. Your order is on hold.`,
        heroBadge: 'Action required',
        heroTitle: "We couldn't process your payment",
        heroSubtitle: `Order ${data.orderNumber} is on hold until payment completes.`,
        content: `
            ${greeting(data.customerName)}
            ${paragraph(`Your payment of <strong style="color:${colors.ink};">${esc(formatCurrency(data.amount))}</strong> for order ${esc(data.orderNumber)} did not go through, so we haven't sent it to ${esc(data.vendorName)} yet.`)}
            ${alertBox('danger', 'What went wrong', data.reason || 'The payment was declined by your bank or card issuer. No money has left your account.')}
            ${infoPanel([
                { label: 'Order number', value: data.orderNumber, emphasis: true },
                { label: 'Amount due', value: formatCurrency(data.amount) },
                { label: 'Reference', value: data.reference || '' },
            ])}
            ${button('Retry payment', data.retryUrl || `${brand.url}/checkout?order=${data.orderId}`)}
            ${paragraph(`<span style="color:${colors.muted};font-size:14px;">Common fixes: check your card balance and expiry date, confirm online transactions are enabled, or try a different payment method.</span>`)}
        `,
        footerNote: `You received this email because a payment attempt on order ${data.orderNumber} failed.`,
    });

export interface RefundProcessedData extends OrderEmailBase {
    refundAmount: number;
    reference?: string;
    refundedAt?: string | Date;
    destination?: string;
    etaDays?: string;
}

/** Refund issued. */
export const refundProcessed = (data: RefundProcessedData): RenderedEmail =>
    compose(`Refund issued for order ${data.orderNumber}`, {
        preheader: `Your refund of ${formatCurrency(data.refundAmount)} is on its way back to you.`,
        heroBadge: 'Refund issued',
        heroTitle: 'Your refund is on the way',
        content: `
            ${greeting(data.customerName)}
            ${paragraph(`We've issued a refund for order <strong style="color:${colors.ink};">${esc(data.orderNumber)}</strong>. The funds are being returned to your original payment method.`)}
            ${amountBlock('Refund amount', data.refundAmount, data.etaDays || 'Expect it within 5–10 business days')}
            ${infoPanel([
                { label: 'Order number', value: data.orderNumber, emphasis: true },
                { label: 'Restaurant', value: data.vendorName },
                { label: 'Refunded to', value: data.destination || 'Original payment method' },
                { label: 'Reference', value: data.reference || '' },
                { label: 'Issued at', value: formatDateTime(data.refundedAt || new Date()) },
            ])}
            ${paragraph(`<span style="color:${colors.muted};font-size:14px;">Timing depends on your bank. If it hasn't arrived after 10 business days, reply to this email with your reference and we'll chase it.</span>`)}
        `,
        footerNote: `You received this email because a refund was issued on order ${data.orderNumber}.`,
    });

/* ================================================================== *
 * 4. VENDOR
 * ================================================================== */

export interface VendorNewOrderData {
    vendorName: string;
    orderId: string;
    orderNumber: string;
    customerName?: string;
    items: EmailOrderItem[];
    totals?: EmailOrderTotals;
    placedAt?: string | Date;
    notes?: string;
    isPaid?: boolean;
    deliveryAddress?: string;
}

/** New order ticket for the restaurant — the most time-critical email we send. */
export const vendorNewOrder = (data: VendorNewOrderData): RenderedEmail =>
    compose(`New order ${data.orderNumber} — ${formatCurrency(data.totals?.total ?? 0)}`, {
        preheader: `${data.orderNumber} just came in. Accept it to start preparing.`,
        heroBadge: 'New order',
        heroTitle: `New order ${data.orderNumber}`,
        heroSubtitle: `Placed ${data.placedAt ? formatDateTime(data.placedAt) : 'just now'} — please accept or decline promptly.`,
        content: `
            ${paragraph(`Hi ${esc(data.vendorName)}, you have a new order waiting.`)}
            ${
                data.isPaid
                    ? alertBox('success', 'Payment confirmed', 'This order has been paid in full. You can start preparing as soon as you accept.')
                    : alertBox('warning', 'Payment pending', 'Payment has not settled yet. Wait for the paid confirmation before preparing this order.')
            }
            ${subheading('Items to prepare')}
            ${orderItemsTable(data.items, data.totals)}
            ${data.notes ? alertBox('info', 'Customer note', data.notes) : ''}
            ${infoPanel([
                { label: 'Order number', value: data.orderNumber, emphasis: true },
                { label: 'Customer', value: data.customerName || 'Fooda customer' },
                { label: 'Deliver to', value: data.deliveryAddress || '' },
                { label: 'Received', value: data.placedAt ? formatDateTime(data.placedAt) : formatDateTime(new Date()) },
            ])}
            ${button('Open in dashboard', `${brand.url}/vendor/orders/${data.orderId}`)}
        `,
        footerNote: `You received this email because you manage ${data.vendorName} on ${brand.name}.`,
    });

export interface VendorApprovedData {
    vendorName: string;
    ownerName?: string;
    dashboardUrl?: string;
}

/** Restaurant application approved. */
export const vendorApproved = (data: VendorApprovedData): RenderedEmail =>
    compose(`${data.vendorName} is approved to sell on ${brand.name}`, {
        preheader: `Your restaurant has been approved. Set up your menu and start receiving orders.`,
        heroBadge: 'Application approved',
        heroTitle: 'Your restaurant is approved',
        heroSubtitle: `${data.vendorName} can now receive orders on ${brand.name}.`,
        content: `
            ${greeting(data.ownerName)}
            ${paragraph(`Congratulations — <strong style="color:${colors.ink};">${esc(data.vendorName)}</strong> has passed our review and is now live on ${brand.name}.`)}
            ${subheading('Before your first order')}
            ${paragraph('1. Complete your restaurant profile, business hours and delivery area.<br>2. Upload your menu with clear photos and accurate prices.<br>3. Confirm your payout account so we can settle your earnings.')}
            ${button('Set up my restaurant', data.dashboardUrl || `${brand.url}/vendor`)}
            ${alertBox('info', 'Payouts', 'Earnings from completed orders are settled to your registered bank account on the platform payout schedule. You can review every order and settlement in your dashboard.')}
        `,
        footerNote: `You received this email because you applied to sell on ${brand.name}.`,
    });

export interface VendorPayoutData {
    vendorName: string;
    ownerName?: string;
    periodStart: string | Date;
    periodEnd: string | Date;
    orderCount: number;
    grossSales: number;
    commission: number;
    otherDeductions?: number;
    netPayout: number;
    payoutReference?: string;
    bankAccount?: string;
    expectedDate?: string | Date;
}

/** Settlement statement for the restaurant. */
export const vendorPayout = (data: VendorPayoutData): RenderedEmail =>
    compose(`Payout of ${formatCurrency(data.netPayout)} for ${data.vendorName}`, {
        preheader: `Your settlement for ${formatDateTime(data.periodStart).split(',')[0]} – ${formatDateTime(data.periodEnd).split(',')[0]} is on the way.`,
        heroBadge: 'Payout statement',
        heroTitle: 'Your payout is on the way',
        heroSubtitle: `Settlement for ${data.orderCount} completed order${data.orderCount === 1 ? '' : 's'}.`,
        content: `
            ${greeting(data.ownerName || data.vendorName)}
            ${paragraph(`Here is the settlement statement for <strong style="color:${colors.ink};">${esc(data.vendorName)}</strong>.`)}
            ${amountBlock('Net payout', data.netPayout, data.expectedDate ? `Expected in your account by ${formatDateTime(data.expectedDate)}` : '')}
            ${subheading('Breakdown')}
            ${infoPanel([
                { label: 'Period', value: `${formatDateTime(data.periodStart)} – ${formatDateTime(data.periodEnd)}` },
                { label: 'Completed orders', value: String(data.orderCount) },
                { label: 'Gross sales', value: formatCurrency(data.grossSales) },
                { label: 'Platform commission', value: `-${formatCurrency(data.commission)}` },
                { label: 'Other deductions', value: data.otherDeductions ? `-${formatCurrency(data.otherDeductions)}` : '' },
                { label: 'Net payout', value: formatCurrency(data.netPayout), emphasis: true },
                { label: 'Paid to', value: data.bankAccount || '' },
                { label: 'Reference', value: data.payoutReference || '' },
            ])}
            ${button('View full statement', `${brand.url}/vendor/payouts`)}
        `,
        footerNote: `You received this statement because you manage ${data.vendorName} on ${brand.name}.`,
    });

/* ================================================================== *
 * 5. DELIVERY / RIDER
 * ================================================================== */

export interface RiderAssignmentData {
    riderName?: string;
    orderId: string;
    orderNumber: string;
    vendorName: string;
    pickupAddress?: string;
    dropoffAddress?: string;
    customerName?: string;
    customerPhone?: string;
    itemCount?: number;
    payout?: number;
    readyBy?: string | Date;
}

/** New delivery assignment for a rider. */
export const riderAssignment = (data: RiderAssignmentData): RenderedEmail =>
    compose(`New delivery — order ${data.orderNumber}`, {
        preheader: `Pick up from ${data.vendorName} and deliver order ${data.orderNumber}.`,
        heroBadge: 'New assignment',
        heroTitle: 'You have a new delivery',
        heroSubtitle: `Order ${data.orderNumber} from ${data.vendorName}.`,
        content: `
            ${greeting(data.riderName)}
            ${paragraph('A delivery has been assigned to you. Please confirm in the app and head to the pickup point.')}
            ${data.payout ? amountBlock('Delivery earnings', data.payout) : ''}
            ${subheading('Pickup')}
            ${infoPanel([
                { label: 'Restaurant', value: data.vendorName, emphasis: true },
                { label: 'Address', value: data.pickupAddress || '' },
                { label: 'Ready by', value: data.readyBy ? formatDateTime(data.readyBy) : 'As soon as possible' },
                { label: 'Items', value: data.itemCount ? String(data.itemCount) : '' },
            ])}
            ${subheading('Drop-off')}
            ${infoPanel([
                { label: 'Customer', value: data.customerName || 'Fooda customer' },
                { label: 'Phone', value: data.customerPhone || '' },
                { label: 'Address', value: data.dropoffAddress || '' },
            ])}
            ${button('Open delivery', `${brand.url}/delivery/orders/${data.orderId}`)}
            ${alertBox('warning', 'Before you set off', 'Check the order contents against the receipt at pickup, and mark each stage in the app so the customer can track you.')}
        `,
        footerNote: `You received this email because you are an active rider on ${brand.name}.`,
    });

export interface RiderApprovedData {
    riderName?: string;
    dashboardUrl?: string;
}

/** Rider application approved. */
export const riderApproved = (data: RiderApprovedData): RenderedEmail =>
    compose(`You're approved to deliver with ${brand.name}`, {
        preheader: 'Your rider account is active. Go online to start receiving deliveries.',
        heroBadge: 'Application approved',
        heroTitle: "You're approved to ride",
        heroSubtitle: `Your ${brand.name} rider account is active.`,
        content: `
            ${greeting(data.riderName)}
            ${paragraph(`Welcome to the ${brand.name} rider network. Your documents have been verified and your account is live.`)}
            ${subheading('How it works')}
            ${paragraph('1. Go online in the rider app when you are ready to work.<br>2. Accept assignments near you and follow the in-app route.<br>3. Mark pickup and delivery in the app — earnings are tracked per completed trip.')}
            ${button('Go online', data.dashboardUrl || `${brand.url}/delivery`)}
        `,
        footerNote: `You received this email because you applied to deliver with ${brand.name}.`,
    });

export interface RiderEarningsData {
    riderName?: string;
    periodStart: string | Date;
    periodEnd: string | Date;
    deliveryCount: number;
    grossEarnings: number;
    bonuses?: number;
    netEarnings: number;
    expectedDate?: string | Date;
}

/** Rider earnings statement. */
export const riderEarnings = (data: RiderEarningsData): RenderedEmail =>
    compose(`Your earnings: ${formatCurrency(data.netEarnings)}`, {
        preheader: `${data.deliveryCount} deliveries completed. Here's your earnings summary.`,
        heroBadge: 'Earnings summary',
        heroTitle: 'Your earnings statement',
        content: `
            ${greeting(data.riderName)}
            ${paragraph(`Thanks for riding with ${brand.name}. Here's what you earned this period.`)}
            ${amountBlock('Total earnings', data.netEarnings, data.expectedDate ? `Paid out by ${formatDateTime(data.expectedDate)}` : '')}
            ${infoPanel([
                { label: 'Period', value: `${formatDateTime(data.periodStart)} – ${formatDateTime(data.periodEnd)}` },
                { label: 'Deliveries completed', value: String(data.deliveryCount) },
                { label: 'Delivery earnings', value: formatCurrency(data.grossEarnings) },
                { label: 'Bonuses & tips', value: data.bonuses ? formatCurrency(data.bonuses) : '' },
                { label: 'Total', value: formatCurrency(data.netEarnings), emphasis: true },
            ])}
            ${button('View earnings', `${brand.url}/delivery/earnings`)}
        `,
        footerNote: `You received this summary because you are an active rider on ${brand.name}.`,
    });

/* ================================================================== *
 * 6. ADMIN / OPERATIONS
 * ================================================================== */

export interface AdminVendorApplicationData {
    vendorName: string;
    ownerName?: string;
    ownerEmail?: string;
    phone?: string;
    address?: string;
    submittedAt?: string | Date;
    reviewUrl?: string;
}

/** Alerts the admin team to a restaurant awaiting review. */
export const adminVendorApplication = (data: AdminVendorApplicationData): RenderedEmail =>
    compose(`[Action] New vendor application — ${data.vendorName}`, {
        preheader: `${data.vendorName} submitted an application and is waiting for review.`,
        heroBadge: 'Admin · needs review',
        heroTitle: 'New vendor application',
        heroSubtitle: `${data.vendorName} is waiting for approval.`,
        content: `
            ${paragraph('A new restaurant has applied to join the platform. Review the details and approve or reject the application.')}
            ${infoPanel([
                { label: 'Restaurant', value: data.vendorName, emphasis: true },
                { label: 'Owner', value: data.ownerName || '' },
                { label: 'Email', value: data.ownerEmail || '' },
                { label: 'Phone', value: data.phone || '' },
                { label: 'Address', value: data.address || '' },
                { label: 'Submitted', value: formatDateTime(data.submittedAt || new Date()) },
            ])}
            ${button('Review application', data.reviewUrl || `${brand.url}/admin/vendors`)}
        `,
        footerNote: 'Internal notification sent to the Fooda operations team.',
    });

export interface AdminAlertData {
    title: string;
    message: string;
    severity?: 'info' | 'warning' | 'danger';
    details?: InfoRow[];
    actionUrl?: string;
    actionLabel?: string;
}

/**
 * Generic operational alert — payment webhook failures, disputes, stuck
 * orders, unusual refund volume. Use `details` to carry the payload.
 */
export const adminAlert = (data: AdminAlertData): RenderedEmail =>
    compose(`[${(data.severity || 'info').toUpperCase()}] ${data.title}`, {
        preheader: data.message.slice(0, 120),
        heroBadge: `Admin · ${data.severity || 'info'}`,
        heroTitle: data.title,
        content: `
            ${alertBox(data.severity || 'info', 'What happened', data.message)}
            ${data.details && data.details.length ? `${subheading('Details')}${infoPanel(data.details)}` : ''}
            ${button(data.actionLabel || 'Open admin dashboard', data.actionUrl || `${brand.url}/admin`)}
        `,
        footerNote: 'Internal notification sent to the Fooda operations team.',
    });

export interface AdminDailySummaryData {
    date: string | Date;
    orders: number;
    delivered: number;
    cancelled: number;
    grossRevenue: number;
    commissionEarned: number;
    newCustomers: number;
    newVendors: number;
    activeRiders?: number;
    failedPayments?: number;
}

/** Daily platform digest for admins. */
export const adminDailySummary = (data: AdminDailySummaryData): RenderedEmail => {
    const stat = (label: string, value: string) => `
      <td class="stack" width="50%" valign="top" style="padding:8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${colors.subtle};border:1px solid ${colors.border};border-radius:8px;">
          <tr><td style="padding:16px 18px;font-family:Arial,sans-serif;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${colors.muted};">${esc(label)}</p>
            <p style="margin:0;font-size:22px;line-height:28px;font-weight:700;color:${colors.ink};">${esc(value)}</p>
          </td></tr>
        </table>
      </td>`;

    return compose(`${brand.name} daily summary — ${formatDateTime(data.date).split(',').slice(0, 2).join(',')}`, {
        preheader: `${data.orders} orders · ${formatCurrency(data.grossRevenue)} gross revenue.`,
        heroBadge: 'Admin · daily digest',
        heroTitle: 'Yesterday on Fooda',
        heroSubtitle: formatDateTime(data.date).split(',').slice(0, 2).join(','),
        content: `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">
              <tr>${stat('Orders placed', String(data.orders))}${stat('Gross revenue', formatCurrency(data.grossRevenue))}</tr>
              <tr>${stat('Delivered', String(data.delivered))}${stat('Cancelled', String(data.cancelled))}</tr>
              <tr>${stat('Commission earned', formatCurrency(data.commissionEarned))}${stat('New customers', String(data.newCustomers))}</tr>
            </table>
            ${divider()}
            ${infoPanel([
                { label: 'New vendors', value: String(data.newVendors) },
                { label: 'Active riders', value: data.activeRiders != null ? String(data.activeRiders) : '' },
                { label: 'Failed payments', value: data.failedPayments != null ? String(data.failedPayments) : '' },
                { label: 'Cancellation rate', value: data.orders ? `${((data.cancelled / data.orders) * 100).toFixed(1)}%` : '0%' },
            ])}
            ${button('Open admin dashboard', `${brand.url}/admin`)}
        `,
        footerNote: 'Internal daily digest sent to the Fooda operations team.',
    });
};

/* ================================================================== *
 * Registry
 * ================================================================== */

export const templates = {
    // Account & auth
    verify_email: verifyEmail,
    welcome,
    password_reset: passwordReset,
    password_changed: passwordChanged,
    // Customer orders
    order_placed: orderPlaced,
    order_status_update: orderStatusUpdate,
    order_out_for_delivery: orderOutForDelivery,
    order_delivered: orderDelivered,
    order_cancelled: orderCancelled,
    // Payments
    payment_receipt: paymentReceipt,
    payment_failed: paymentFailed,
    refund_processed: refundProcessed,
    // Vendor
    vendor_new_order: vendorNewOrder,
    vendor_approved: vendorApproved,
    vendor_payout: vendorPayout,
    // Rider
    rider_assignment: riderAssignment,
    rider_approved: riderApproved,
    rider_earnings: riderEarnings,
    // Admin
    admin_vendor_application: adminVendorApplication,
    admin_alert: adminAlert,
    admin_daily_summary: adminDailySummary,
} as const;

export type TemplateId = keyof typeof templates;
