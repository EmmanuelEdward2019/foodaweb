# Fooda transactional email

White, corporate email templates built on the Fooda brand yellow, rendered in
TypeScript and delivered through [Resend](https://resend.com).

```
_shared/emails/
├── layout.ts      Brand shell (logo + tagline header) and building blocks
├── templates.ts   Every email the platform sends, as a typed function
├── resend.ts      Dependency-free Resend REST client
└── index.ts       sendTemplateEmail() — render + send in one call
```

## Design

Every message renders in the same shell: white background, Fooda wordmark and
tagline in a white header band, a 3px brand-yellow rule beneath it, near-black
body copy, and yellow reserved for accents — buttons, badges, key figures and
the progress tracker. Table-based markup with inline styles throughout, so it
survives Gmail, Outlook and Apple Mail. Every template also returns a plain-text
alternative, which materially improves spam scoring.

Set `EMAIL_LOGO_URL` to a hosted **PNG or JPG** (~360×96) to swap the wordmark
for your logo image. Do not point it at an SVG — Gmail and Outlook strip those.

## Sending

```ts
import { sendTemplateEmail } from '../_shared/emails/index.ts';

await sendTemplateEmail({
  template: 'payment_receipt',
  to: customer.email,
  data: {
    customerName: customer.full_name,
    orderId: order.id,
    orderNumber: order.order_number,
    vendorName: vendor.name,
    amount: order.total_amount,
    reference: order.payment_reference,
    items, totals,
  },
  // Stable per event — Resend de-duplicates for 24h, so a function retry
  // cannot double-send.
  idempotencyKey: `payment-receipt-${order.id}`,
});
```

`sendTemplateEmail` never throws. Email is a side effect of order flows and must
not be able to fail an order — check the returned `{ success, error, retryable }`
and log it.

## Templates

| Template id | Recipient | Sent when |
| --- | --- | --- |
| `verify_email` | Customer / vendor / rider | Sign-up, to confirm the address |
| `welcome` | Any role | Email confirmed — role-aware onboarding steps |
| `password_reset` | Any role | Forgot-password requested |
| `password_changed` | Any role | Password actually changed (security notice) |
| `order_placed` | Customer | Order created, awaiting vendor acceptance |
| `order_status_update` | Customer | Status → `confirmed`, `preparing`, `ready_for_pickup` |
| `order_out_for_delivery` | Customer | Status → `picked_up`, includes rider details |
| `order_delivered` | Customer | Status → `delivered`, with review prompt |
| `order_cancelled` | Customer | Status → `cancelled`, with refund expectations |
| `payment_receipt` | Customer | `payment_status` → `completed` |
| `payment_failed` | Customer | Payment declined — retry call to action |
| `refund_processed` | Customer | `payment_status` → `refunded` |
| `vendor_new_order` | Vendor | Order created — the kitchen ticket |
| `vendor_approved` | Vendor | Restaurant application approved |
| `vendor_payout` | Vendor | Settlement statement for a payout period |
| `rider_assignment` | Rider | `delivery_person_id` assigned to an order |
| `rider_approved` | Rider | Rider application approved |
| `rider_earnings` | Rider | Earnings statement for a period |
| `admin_vendor_application` | Admin | Restaurant submitted an application |
| `admin_alert` | Admin | Generic ops alert (webhook failures, disputes) |
| `admin_daily_summary` | Admin | Daily platform digest |

Payload types live next to each template in `templates.ts`; field names mirror
the database (`order_number`, `total_amount`, …) so rows pass through with
minimal reshaping.

## Previewing

```bash
node scripts/preview-emails.ts        # renders all templates + a gallery
open .email-previews/index.html
```

Add `--auth` to also regenerate `supabase/templates/auth/*.html` from the same
designs, so the auth emails can never drift from the transactional ones.

## Supabase Auth emails

Sign-up confirmation and password reset are sent by Supabase Auth (GoTrue), not
by these edge functions — so they exist twice on purpose:

- `verify_email` / `password_reset` here, for when you send them yourself.
- `supabase/templates/auth/*.html`, generated from the same designs with Go
  template variables (`{{ .ConfirmationURL }}`) for the Supabase dashboard.

To route Supabase Auth through Resend, in **Authentication → Emails → SMTP**:

| Field | Value |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` (or `587`) |
| Username | `resend` |
| Password | your `RESEND_API_KEY` |
| Sender email | `no-reply@yourdomain.com` (must be a verified domain) |
| Sender name | `Fooda` |

Then paste each file's contents into the matching template under
**Authentication → Emails → Templates**, with these subjects:

| File | Template | Subject |
| --- | --- | --- |
| `confirm-signup.html` | Confirm signup | Confirm your Fooda account |
| `reset-password.html` | Reset password | Reset your Fooda password |
| `magic-link.html` | Magic link | Your Fooda sign-in link |
| `email-change.html` | Change email address | Confirm your new email address |
| `invite-user.html` | Invite user | You've been invited to Fooda |

Because these are static files, the footer copyright year is fixed at generation
time — re-run the generator and re-paste once a year, or whenever the branding
changes.

## Environment

Secrets belong in Supabase Edge Function secrets, never in the repo. See
`SUPABASE_SECRETS.md`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | **yes** | Resend API key. Without it, sends are skipped and logged. |
| `RESEND_FROM_EMAIL` | recommended | Envelope from address. Defaults to `orders@fooda.com`. |
| `RESEND_FROM_NAME` | recommended | Display name. Defaults to `Fooda`. |
| `RESEND_REPLY_TO` | optional | Reply-to for every send. |
| `ADMIN_ALERT_EMAILS` | optional | Comma-separated admin recipients for alerts/digests. |
| `EMAIL_BRAND_NAME` | optional | Wordmark text. Defaults to `Fooda`. |
| `EMAIL_BRAND_TAGLINE` | optional | Line under the wordmark. |
| `EMAIL_BRAND_URL` | optional | Base URL for every link in the emails. |
| `EMAIL_LOGO_URL` | optional | Hosted PNG/JPG logo. Falls back to the wordmark. |
| `EMAIL_SUPPORT_ADDRESS` | optional | Support address in the footer. |
| `EMAIL_SUPPORT_PHONE` | optional | Support phone in the footer. |
| `EMAIL_COMPANY_ADDRESS` | optional | Legal address in the footer. |
| `EMAIL_CURRENCY_SYMBOL` | optional | Defaults to `₦`. |

## Not yet wired

The existing `send-notifications` function still sends its generic one-size
email through SendGrid. These templates are not called from it yet — wiring the
edge functions (`create-order`, `verify-payment`, `payment-webhook`,
`update-order-status`) to `sendTemplateEmail` is the next step.
