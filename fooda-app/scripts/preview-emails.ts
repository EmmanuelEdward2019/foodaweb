/**
 * Renders every Fooda email template with sample data.
 *
 *   node scripts/preview-emails.ts          # writes previews + opens the gallery
 *   node scripts/preview-emails.ts --auth   # also regenerates supabase/templates/auth/*.html
 *
 * Output: .email-previews/ (gitignored) with one HTML file per template and an
 * index.html gallery. Node 23.6+ runs this .ts file directly.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { templates } from '../supabase/functions/_shared/emails/templates.ts';
import type { RenderedEmail } from '../supabase/functions/_shared/emails/templates.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const outDir = join(root, '.email-previews');

const now = new Date();
const soon = new Date(now.getTime() + 35 * 60 * 1000);

const items = [
    { name: 'Jollof Rice & Grilled Chicken', quantity: 2, total: 9000, note: 'Extra pepper, no onions' },
    { name: 'Beef Suya Platter', quantity: 1, total: 5500 },
    { name: 'Chapman (50cl)', quantity: 2, total: 2400 },
];

const totals = { subtotal: 16900, deliveryFee: 1200, tax: 1267.5, total: 19367.5 };

const order = {
    customerName: 'Adaeze Okonkwo',
    orderId: '9f2b1c44-77aa-4c1e-9f3d-2b6a5e8d1c07',
    orderNumber: 'ORD-20260820-0042',
    vendorName: 'Mama Put Kitchen',
    items,
    totals,
    deliveryAddress: '14B Admiralty Way, Lekki Phase 1, Lagos',
    placedAt: now,
    estimatedDelivery: soon,
    paymentMethod: 'card',
    notes: 'Please call when you arrive at the gate.',
};

/** Sample payload for every template in the registry. */
const samples: Record<string, unknown> = {
    verify_email: {
        name: 'Adaeze Okonkwo',
        confirmationUrl: 'https://fooda.com/auth/confirm?token=sample-token-value',
        expiresInHours: 24,
    },
    welcome: { name: 'Adaeze Okonkwo', role: 'customer', ctaUrl: 'https://fooda.com/restaurants' },
    password_reset: {
        name: 'Adaeze Okonkwo',
        resetUrl: 'https://fooda.com/auth/update-password?token=sample-token-value',
        expiresInMinutes: 60,
        requestedFrom: 'Chrome on macOS · Lagos, NG',
        requestedAt: now,
    },
    password_changed: { name: 'Adaeze Okonkwo', changedAt: now, device: 'Chrome on macOS · Lagos, NG' },

    order_placed: order,
    order_status_update: { ...order, status: 'preparing', estimatedPrepTime: 25 },
    order_out_for_delivery: { ...order, riderName: 'Emeka Nwosu', riderPhone: '+234 803 000 0000', vehicle: 'Motorcycle · LAG-882-KJA' },
    order_delivered: { ...order, deliveredAt: now, riderName: 'Emeka Nwosu' },
    order_cancelled: { ...order, cancelledBy: 'vendor', reason: 'The kitchen is out of jollof rice this evening.', refundAmount: 19367.5 },

    payment_receipt: { ...order, amount: 19367.5, reference: 'fooda_ps_8XK2M4NQ71', paidAt: now, paymentChannel: 'Visa •••• 4081 (Paystack)' },
    payment_failed: { ...order, amount: 19367.5, reference: 'fooda_ps_8XK2M4NQ71', reason: 'Your bank declined the transaction (insufficient funds).' },
    refund_processed: { ...order, refundAmount: 19367.5, reference: 'fooda_rf_2LP9C3ZR55', refundedAt: now, destination: 'Visa •••• 4081' },

    vendor_new_order: {
        vendorName: 'Mama Put Kitchen',
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        customerName: 'Adaeze Okonkwo',
        items,
        totals,
        placedAt: now,
        notes: 'Please call when you arrive at the gate.',
        isPaid: true,
        deliveryAddress: order.deliveryAddress,
    },
    vendor_approved: { vendorName: 'Mama Put Kitchen', ownerName: 'Chidinma Eze' },
    vendor_payout: {
        vendorName: 'Mama Put Kitchen',
        ownerName: 'Chidinma Eze',
        periodStart: new Date(now.getTime() - 7 * 864e5),
        periodEnd: now,
        orderCount: 148,
        grossSales: 1284500,
        commission: 192675,
        otherDeductions: 4500,
        netPayout: 1087325,
        payoutReference: 'PYT-20260820-0031',
        bankAccount: 'GTBank •••• 4471',
        expectedDate: new Date(now.getTime() + 2 * 864e5),
    },

    rider_assignment: {
        riderName: 'Emeka Nwosu',
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        vendorName: 'Mama Put Kitchen',
        pickupAddress: '7 Awolowo Road, Ikoyi, Lagos',
        dropoffAddress: order.deliveryAddress,
        customerName: 'Adaeze Okonkwo',
        customerPhone: '+234 802 111 2222',
        itemCount: 5,
        payout: 1200,
        readyBy: soon,
    },
    rider_approved: { riderName: 'Emeka Nwosu' },
    rider_earnings: {
        riderName: 'Emeka Nwosu',
        periodStart: new Date(now.getTime() - 7 * 864e5),
        periodEnd: now,
        deliveryCount: 63,
        grossEarnings: 75600,
        bonuses: 8200,
        netEarnings: 83800,
        expectedDate: new Date(now.getTime() + 2 * 864e5),
    },

    admin_vendor_application: {
        vendorName: 'Suya Republic',
        ownerName: 'Bala Mohammed',
        ownerEmail: 'bala@suyarepublic.ng',
        phone: '+234 809 444 5555',
        address: '22 Isaac John Street, Ikeja GRA, Lagos',
        submittedAt: now,
    },
    admin_alert: {
        title: 'Paystack webhook failures detected',
        message: '7 payment webhooks failed signature verification in the last hour. Payments may not be marked as completed.',
        severity: 'danger',
        details: [
            { label: 'Failed webhooks', value: '7', emphasis: true },
            { label: 'Window', value: 'Last 60 minutes' },
            { label: 'Affected orders', value: 'ORD-20260820-0031, ORD-20260820-0038' },
            { label: 'Function', value: 'payment-webhook' },
        ],
        actionLabel: 'Inspect failed payments',
    },
    admin_daily_summary: {
        date: now,
        orders: 412,
        delivered: 389,
        cancelled: 23,
        grossRevenue: 3841250,
        commissionEarned: 576187,
        newCustomers: 74,
        newVendors: 3,
        activeRiders: 46,
        failedPayments: 9,
    },
};

mkdirSync(outDir, { recursive: true });

const rendered: { id: string; subject: string; file: string }[] = [];

for (const [id, render] of Object.entries(templates)) {
    const sample = samples[id];
    if (!sample) {
        console.warn(`no sample data for template "${id}" — skipped`);
        continue;
    }
    const email = (render as (d: unknown) => RenderedEmail)(sample);
    const file = `${id}.html`;
    writeFileSync(join(outDir, file), email.html, 'utf8');
    writeFileSync(join(outDir, `${id}.txt`), `Subject: ${email.subject}\n\n${email.text}`, 'utf8');
    rendered.push({ id, subject: email.subject, file });
}

// Gallery
const gallery = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fooda email templates</title>
<style>
  body{margin:0;background:#fafafa;font-family:'Poppins',-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;}
  header{background:#fff;border-bottom:3px solid #ffc107;padding:28px 32px;}
  h1{margin:0;font-size:24px;} header p{margin:6px 0 0;color:#6b7280;font-size:14px;}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px;padding:28px 32px;}
  .card{background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;display:flex;flex-direction:column;}
  .card h2{margin:0;font-size:14px;padding:14px 16px 4px;}
  .card p{margin:0;padding:0 16px 12px;font-size:12px;color:#6b7280;}
  .card iframe{width:100%;height:420px;border:0;border-top:1px solid #e5e7eb;background:#fff;}
  .card a{display:block;padding:10px 16px;font-size:13px;font-weight:600;color:#1a1a1a;background:#ffc107;text-decoration:none;text-align:center;}
  code{background:#f3f4f6;padding:1px 5px;border-radius:3px;font-size:11px;}
</style></head><body>
<header><h1>Fooda email templates</h1><p>${rendered.length} templates rendered with sample data · plain-text versions saved alongside as <code>.txt</code></p></header>
<div class="grid">
${rendered
    .map(
        (r) => `  <div class="card">
    <h2>${r.id}</h2>
    <p>${r.subject.replace(/</g, '&lt;')}</p>
    <iframe src="${r.file}" title="${r.id}" loading="lazy"></iframe>
    <a href="${r.file}" target="_blank">Open full size</a>
  </div>`,
    )
    .join('\n')}
</div></body></html>`;

writeFileSync(join(outDir, 'index.html'), gallery, 'utf8');

console.log(`Rendered ${rendered.length} templates to ${outDir}`);
console.log(`Open: ${join(outDir, 'index.html')}`);

/* ------------------------------------------------------------------ *
 * Supabase Auth templates
 * ------------------------------------------------------------------ *
 * Auth emails are sent by GoTrue, not by our edge functions, so they need
 * Go template variables ({{ .ConfirmationURL }}) rather than real URLs.
 * We render the same designs with sentinel URLs and swap them afterwards so
 * the auth emails can never drift from the transactional ones.
 */
if (process.argv.includes('--auth')) {
    const authOut = join(root, 'supabase', 'templates', 'auth');
    mkdirSync(authOut, { recursive: true });

    const SENTINEL = 'https://fooda-auth-action-url.invalid';
    const swap = (html: string, goVar: string) =>
        html.split(SENTINEL).join(goVar).replace(/Fooda &lt;action-url&gt;/g, goVar);

    const authFiles: { file: string; html: string }[] = [
        {
            file: 'confirm-signup.html',
            html: swap(
                templates.verify_email({ confirmationUrl: SENTINEL, expiresInHours: 24 }).html,
                '{{ .ConfirmationURL }}',
            ),
        },
        {
            file: 'reset-password.html',
            html: swap(
                templates.password_reset({ resetUrl: SENTINEL, expiresInMinutes: 60 }).html,
                '{{ .ConfirmationURL }}',
            ),
        },
        {
            file: 'magic-link.html',
            html: swap(
                templates.verify_email({ confirmationUrl: SENTINEL, expiresInHours: 1 }).html,
                '{{ .ConfirmationURL }}',
            )
                .replace(/Confirm your email/g, 'Sign in to Fooda')
                .replace(/Confirm my email/g, 'Sign in to Fooda'),
        },
        {
            file: 'email-change.html',
            html: swap(
                templates.verify_email({ confirmationUrl: SENTINEL, expiresInHours: 24 }).html,
                '{{ .ConfirmationURL }}',
            )
                .replace(/Verify your email/g, 'Confirm email change')
                .replace(/Welcome to Fooda/g, 'Confirm your new email'),
        },
        {
            file: 'invite-user.html',
            html: swap(
                templates.verify_email({ confirmationUrl: SENTINEL, expiresInHours: 168 }).html,
                '{{ .ConfirmationURL }}',
            )
                .replace(/Verify your email/g, "You're invited")
                .replace(/Confirm my email/g, 'Accept invitation'),
        },
    ];

    for (const { file, html } of authFiles) {
        writeFileSync(join(authOut, file), html, 'utf8');
    }
    console.log(`Wrote ${authFiles.length} Supabase Auth templates to ${authOut}`);
}
