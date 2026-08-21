// Shared email layout + building blocks for all Fooda transactional emails.
//
// Design direction: white, corporate, restrained. The Fooda logo and tagline
// sit in a white header band, brand yellow is used for accents (rules, badges,
// buttons, key figures) rather than as a background wash, and body copy stays
// near-black on white for maximum legibility and printability.
//
// Everything renders plain, table-based HTML with inline styles: that is what
// Gmail / Outlook / Apple Mail actually agree on. No flexbox, no grid, no
// external stylesheets, no web font that matters if it fails to load.
//
// The module deliberately avoids Deno-only APIs (see `env` below) so the same
// templates can be rendered by the Node preview script in scripts/.

const env = (key: string): string | undefined => {
    // deno-lint-ignore no-explicit-any
    const g = globalThis as any;
    return g.Deno?.env?.get?.(key) ?? g.process?.env?.[key];
};

export const brand = {
    name: env('EMAIL_BRAND_NAME') || 'Fooda',
    tagline: env('EMAIL_BRAND_TAGLINE') || 'Bringing delicious food to your doorstep',
    /** Public site URL — used for links and the logo lockup. */
    url: env('EMAIL_BRAND_URL') || env('PUBLIC_SITE_URL') || 'https://fooda.com',
    supportEmail: env('EMAIL_SUPPORT_ADDRESS') || 'support@fooda.com',
    supportPhone: env('EMAIL_SUPPORT_PHONE') || '',
    /**
     * Hosted logo image (PNG/JPG, ~360x96 for a crisp 180px render).
     * Leave unset to fall back to the text wordmark, which renders everywhere.
     * SVG is deliberately not supported — Gmail and Outlook strip it.
     */
    logoUrl: env('EMAIL_LOGO_URL') || '',
    address: env('EMAIL_COMPANY_ADDRESS') || 'Lagos, Nigeria',
    currency: env('EMAIL_CURRENCY_SYMBOL') || '₦',
};

export const colors = {
    /** Primary brand yellow — fills, rules, badges, buttons. */
    yellow: '#ffc107',
    yellowDark: '#e0a800',
    /** Very light yellow wash for highlight panels. */
    yellowTint: '#fffbeb',
    /** Secondary amber, for eyebrows and small emphasis. */
    amber: '#f7931e',
    /** Legacy Fooda orange — links and the logo accent only. */
    orange: '#ff6b35',
    ink: '#1a1a1a',
    body: '#4b5563',
    muted: '#6b7280',
    faint: '#9ca3af',
    border: '#e5e7eb',
    borderLight: '#f0f0f0',
    surface: '#ffffff',
    canvas: '#ffffff',
    subtle: '#fafafa',
    success: '#16a34a',
    successBg: '#f0fdf4',
    danger: '#dc2626',
    dangerBg: '#fef2f2',
    warning: '#b45309',
    warningBg: '#fffbeb',
    info: '#4f46e5',
    infoBg: '#eef2ff',
};

const FONT_STACK =
    "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/** Escape untrusted values (names, addresses, notes) before interpolating. */
export const esc = (value: unknown): string =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

/** Only allow links we are willing to put in front of a user's mail client. */
export const safeUrl = (url: string): string => {
    const trimmed = String(url ?? '').trim();
    return /^https?:\/\//i.test(trimmed) ? esc(trimmed) : '#';
};

export const formatCurrency = (amount: number | string): string => {
    const n = Number(amount ?? 0);
    return `${brand.currency}${(Number.isFinite(n) ? n : 0).toLocaleString('en-NG', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

export const formatDateTime = (value: string | Date): string => {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-NG', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
    });
};

export const formatTime = (value: string | Date): string => {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit', hour12: true });
};

/* ------------------------------------------------------------------ *
 * Building blocks
 * ------------------------------------------------------------------ */

/**
 * Primary call-to-action: brand yellow fill with near-black label.
 * Yellow-on-white needs a dark label to stay readable and accessible.
 */
export const button = (label: string, url: string, variant: 'primary' | 'ghost' = 'primary'): string => {
    const href = safeUrl(url);
    const bg = variant === 'primary' ? colors.yellow : colors.surface;
    const fg = colors.ink;
    const border = variant === 'primary' ? colors.yellow : colors.border;
    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr>
    <td align="center" bgcolor="${bg}" style="border-radius:6px;border:1px solid ${border};">
      <a href="${href}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:${FONT_STACK};font-size:15px;font-weight:600;line-height:20px;color:${fg};text-decoration:none;border-radius:6px;">${esc(label)}</a>
    </td>
  </tr>
</table>`;
};

/** Secondary link shown under a button, for clients that mangle the anchor. */
export const fallbackLink = (url: string): string => `
<p style="margin:0 0 8px;font-family:${FONT_STACK};font-size:13px;line-height:20px;color:${colors.muted};">
  Button not working? Copy and paste this link into your browser:
</p>
<p style="margin:0 0 8px;font-family:${FONT_STACK};font-size:13px;line-height:20px;word-break:break-all;">
  <a href="${safeUrl(url)}" target="_blank" style="color:${colors.orange};text-decoration:underline;">${esc(url)}</a>
</p>`;

export const paragraph = (html: string, extraStyle = ''): string => `
<p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:15px;line-height:25px;color:${colors.body};${extraStyle}">${html}</p>`;

export const heading = (text: string): string => `
<h2 style="margin:0 0 14px;font-family:${FONT_STACK};font-size:20px;line-height:28px;font-weight:700;color:${colors.ink};">${esc(text)}</h2>`;

export const subheading = (text: string): string => `
<h3 style="margin:28px 0 12px;font-family:${FONT_STACK};font-size:12px;line-height:18px;font-weight:700;color:${colors.muted};text-transform:uppercase;letter-spacing:1px;">${esc(text)}</h3>`;

export const divider = (): string =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:1px;background:${colors.border};font-size:0;line-height:0;">&nbsp;</td></tr></table>`;

/** Big, scannable figure — order total, payout amount, earnings. */
export const amountBlock = (label: string, amount: number | string, note = ''): string => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;background:${colors.yellowTint};border:1px solid #fde68a;border-radius:8px;">
  <tr>
    <td style="padding:20px 24px;text-align:center;">
      <p style="margin:0 0 6px;font-family:${FONT_STACK};font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${colors.warning};">${esc(label)}</p>
      <p style="margin:0;font-family:${FONT_STACK};font-size:32px;line-height:40px;font-weight:700;color:${colors.ink};">${esc(typeof amount === 'number' ? formatCurrency(amount) : amount)}</p>
      ${note ? `<p style="margin:8px 0 0;font-family:${FONT_STACK};font-size:13px;line-height:20px;color:${colors.muted};">${esc(note)}</p>` : ''}
    </td>
  </tr>
</table>`;

export interface InfoRow {
    label: string;
    value: string;
    /** Render the value bold + near-black (totals, order numbers). */
    emphasis?: boolean;
}

/** Key/value panel — order meta, payout breakdown, delivery details. */
export const infoPanel = (rows: InfoRow[]): string => {
    const body = rows
        .filter((r) => r && r.value !== '' && r.value != null)
        .map(
            (r) => `
      <tr>
        <td style="padding:7px 0;font-family:${FONT_STACK};font-size:14px;line-height:22px;color:${colors.muted};" valign="top">${esc(r.label)}</td>
        <td align="right" style="padding:7px 0;font-family:${FONT_STACK};font-size:14px;line-height:22px;font-weight:600;color:${colors.ink};" valign="top">${esc(r.value)}</td>
      </tr>`,
        )
        .join('');
    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;background:${colors.subtle};border:1px solid ${colors.border};border-radius:8px;">
  <tr><td style="padding:16px 20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}</table></td></tr>
</table>`;
};

export interface EmailOrderItem {
    name: string;
    quantity: number;
    total: number;
    /** Add-ons, "no onions", etc. */
    note?: string;
}

export interface EmailOrderTotals {
    subtotal: number;
    deliveryFee?: number;
    tax?: number;
    discount?: number;
    total: number;
}

/** Itemised order table used by receipts, vendor tickets and delivery notes. */
export const orderItemsTable = (items: EmailOrderItem[], totals?: EmailOrderTotals): string => {
    const rows = (items || [])
        .map(
            (item) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid ${colors.borderLight};font-family:${FONT_STACK};font-size:14px;line-height:22px;color:${colors.ink};" valign="top">
          <span style="font-weight:600;">${esc(item.quantity)}&times; ${esc(item.name)}</span>
          ${item.note ? `<br><span style="font-size:13px;color:${colors.muted};">${esc(item.note)}</span>` : ''}
        </td>
        <td align="right" style="padding:12px 0;border-bottom:1px solid ${colors.borderLight};font-family:${FONT_STACK};font-size:14px;line-height:22px;font-weight:600;color:${colors.ink};white-space:nowrap;" valign="top">${esc(formatCurrency(item.total))}</td>
      </tr>`,
        )
        .join('');

    const totalRow = (label: string, value: string, strong = false) => `
      <tr>
        <td style="padding:${strong ? '12px 0 0' : '6px 0 0'};font-family:${FONT_STACK};font-size:14px;line-height:22px;font-weight:${strong ? '700' : '400'};color:${strong ? colors.ink : colors.muted};">${esc(label)}</td>
        <td align="right" style="padding:${strong ? '12px 0 0' : '6px 0 0'};font-family:${FONT_STACK};font-size:${strong ? '18px' : '14px'};line-height:24px;font-weight:${strong ? '700' : '600'};color:${colors.ink};white-space:nowrap;">${esc(value)}</td>
      </tr>`;

    const totalsHtml = totals
        ? `
      <tr><td colspan="2" style="padding-top:10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${totalRow('Subtotal', formatCurrency(totals.subtotal))}
        ${totals.deliveryFee != null ? totalRow('Delivery fee', formatCurrency(totals.deliveryFee)) : ''}
        ${totals.tax != null && Number(totals.tax) > 0 ? totalRow('Tax & charges', formatCurrency(totals.tax)) : ''}
        ${totals.discount != null && Number(totals.discount) > 0 ? totalRow('Discount', `-${formatCurrency(totals.discount)}`) : ''}
        ${totalRow('Total', formatCurrency(totals.total), true)}
      </table></td></tr>`
        : '';

    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px;">
  ${rows}
  ${totalsHtml}
</table>`;
};

/**
 * Order progress bar. Steps the customer actually sees, in order.
 * `current` accepts any orders.status value.
 */
export const statusTracker = (current: string): string => {
    const steps = [
        { key: 'confirmed', label: 'Confirmed' },
        { key: 'preparing', label: 'Preparing' },
        { key: 'ready_for_pickup', label: 'Ready' },
        { key: 'picked_up', label: 'On the way' },
        { key: 'delivered', label: 'Delivered' },
    ];
    const activeIndex = steps.findIndex((s) => s.key === current);
    const width = (100 / steps.length).toFixed(4);

    const cells = steps
        .map((step, i) => {
            const done = activeIndex >= 0 && i <= activeIndex;
            const dot = done ? colors.yellow : '#e5e7eb';
            const ring = done ? colors.yellowDark : '#e5e7eb';
            const text = done ? colors.ink : colors.faint;
            return `
        <td width="${width}%" align="center" style="padding:0 2px;font-family:${FONT_STACK};">
          <div style="width:12px;height:12px;line-height:12px;font-size:0;border-radius:50%;background:${dot};border:1px solid ${ring};margin:0 auto 8px;">&nbsp;</div>
          <span style="font-size:11px;line-height:16px;font-weight:${done ? '700' : '400'};color:${text};">${esc(step.label)}</span>
        </td>`;
        })
        .join('');

    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 24px;">
  <tr><td style="padding:0 0 10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:2px;background:${colors.border};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>
  <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table></td></tr>
</table>`;
};

export type AlertVariant = 'success' | 'warning' | 'danger' | 'info';

/** Callout for security notices, failures and time-sensitive information. */
export const alertBox = (variant: AlertVariant, title: string, message: string): string => {
    const palette: Record<AlertVariant, { bg: string; fg: string; border: string }> = {
        success: { bg: colors.successBg, fg: colors.success, border: '#bbf7d0' },
        warning: { bg: colors.warningBg, fg: colors.warning, border: '#fde68a' },
        danger: { bg: colors.dangerBg, fg: colors.danger, border: '#fecaca' },
        info: { bg: colors.infoBg, fg: colors.info, border: '#c7d2fe' },
    };
    const { bg, fg, border } = palette[variant] || palette.info;
    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;background:${bg};border:1px solid ${border};border-left:3px solid ${fg};border-radius:6px;">
  <tr><td style="padding:14px 18px;font-family:${FONT_STACK};">
    ${title ? `<p style="margin:0 0 4px;font-size:14px;font-weight:700;line-height:20px;color:${fg};">${esc(title)}</p>` : ''}
    <p style="margin:0;font-size:14px;line-height:22px;color:${colors.ink};">${esc(message)}</p>
  </td></tr>
</table>`;
};

/** Small yellow pill used above the headline, e.g. "ORDER #ORD-20260820-0042". */
export const badge = (text: string): string => `
<span style="display:inline-block;padding:5px 12px;border-radius:4px;background:${colors.yellowTint};border:1px solid #fde68a;font-family:${FONT_STACK};font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${colors.warning};">${esc(text)}</span>`;

/* ------------------------------------------------------------------ *
 * Page shell
 * ------------------------------------------------------------------ */

export interface LayoutOptions {
    /** Inbox preview line. Keep under ~90 chars. */
    preheader: string;
    /** The headline at the top of the message body. */
    heroTitle: string;
    /** Optional pill above the headline. */
    heroBadge?: string;
    /** Optional line under the headline. */
    heroSubtitle?: string;
    /** Main content — compose with the helpers above. */
    content: string;
    /** Small print above the footer links (e.g. why they got this email). */
    footerNote?: string;
    /** Adds an unsubscribe line. Never set this on auth or receipt emails. */
    unsubscribeUrl?: string;
}

/** White header band carrying the Fooda logo lockup and tagline. */
const renderHeader = (): string => {
    const logo = brand.logoUrl
        ? `<img src="${safeUrl(brand.logoUrl)}" width="180" alt="${esc(brand.name)}" style="display:block;border:0;max-width:180px;height:auto;margin:0 auto;">`
        : `<span style="font-family:${FONT_STACK};font-size:30px;line-height:38px;font-weight:700;letter-spacing:-.6px;color:${colors.ink};">${esc(brand.name)}<span style="color:${colors.yellow};">.</span></span>`;

    return `
        <tr>
          <td align="center" bgcolor="${colors.surface}" style="padding:32px 40px 22px;background:${colors.surface};">
            <a href="${safeUrl(brand.url)}" target="_blank" style="text-decoration:none;">${logo}</a>
            <p style="margin:8px 0 0;font-family:${FONT_STACK};font-size:12px;line-height:18px;font-weight:500;letter-spacing:.4px;color:${colors.muted};">${esc(brand.tagline)}</p>
          </td>
        </tr>
        <tr>
          <td style="height:3px;background:${colors.yellow};font-size:0;line-height:0;">&nbsp;</td>
        </tr>`;
};

export const renderEmail = (options: LayoutOptions): string => {
    const { preheader, heroTitle, heroBadge, heroSubtitle, content, footerNote, unsubscribeUrl } = options;

    return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(heroTitle)}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  :root{color-scheme:light only;supported-color-schemes:light only;}
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}
  img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none;}
  body{margin:0!important;padding:0!important;width:100%!important;background:${colors.canvas};}
  a{color:${colors.orange};}
  @media only screen and (max-width:620px){
    .wrap{width:100%!important;}
    .px{padding-left:24px!important;padding-right:24px!important;}
    .hero-title{font-size:22px!important;line-height:30px!important;}
    .stack{display:block!important;width:100%!important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${colors.canvas};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:#ffffff;">${esc(preheader)}</div>
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${colors.canvas};">
  <tr>
    <td align="center" style="padding:24px 12px 40px;">
      <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${colors.surface};border:1px solid ${colors.border};border-radius:10px;overflow:hidden;">

        ${renderHeader()}

        <!-- Headline -->
        <tr>
          <td class="px" style="padding:34px 40px 0;">
            ${heroBadge ? `<div style="margin:0 0 14px;">${badge(heroBadge)}</div>` : ''}
            <h1 class="hero-title" style="margin:0;font-family:${FONT_STACK};font-size:26px;line-height:34px;font-weight:700;color:${colors.ink};">${esc(heroTitle)}</h1>
            ${heroSubtitle ? `<p style="margin:10px 0 0;font-family:${FONT_STACK};font-size:15px;line-height:24px;color:${colors.muted};">${esc(heroSubtitle)}</p>` : ''}
          </td>
        </tr>

        <!-- Content -->
        <tr>
          <td class="px" style="padding:24px 40px 12px;">${content}</td>
        </tr>

        <!-- Support -->
        <tr>
          <td class="px" style="padding:8px 40px 32px;">
            ${divider()}
            <p style="margin:18px 0 0;font-family:${FONT_STACK};font-size:13px;line-height:21px;color:${colors.muted};">
              Need a hand? Reply to this email or reach us at
              <a href="mailto:${esc(brand.supportEmail)}" style="color:${colors.orange};text-decoration:underline;">${esc(brand.supportEmail)}</a>${brand.supportPhone ? ` or ${esc(brand.supportPhone)}` : ''}.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:22px 40px 26px;background:${colors.subtle};border-top:1px solid ${colors.border};">
            ${footerNote ? `<p style="margin:0 0 10px;font-family:${FONT_STACK};font-size:12px;line-height:19px;color:${colors.muted};">${esc(footerNote)}</p>` : ''}
            <p style="margin:0 0 6px;font-family:${FONT_STACK};font-size:12px;line-height:19px;color:${colors.faint};">
              &copy; ${new Date().getFullYear()} ${esc(brand.name)}. ${esc(brand.address)}. All rights reserved.
            </p>
            <p style="margin:0;font-family:${FONT_STACK};font-size:12px;line-height:19px;color:${colors.faint};">
              <a href="${safeUrl(brand.url)}" style="color:${colors.faint};text-decoration:underline;">Visit ${esc(brand.name)}</a>
              &nbsp;&middot;&nbsp;
              <a href="${safeUrl(`${brand.url}/privacy-policy.html`)}" style="color:${colors.faint};text-decoration:underline;">Privacy</a>
              &nbsp;&middot;&nbsp;
              <a href="${safeUrl(`${brand.url}/terms-of-service.html`)}" style="color:${colors.faint};text-decoration:underline;">Terms</a>
              ${unsubscribeUrl ? `&nbsp;&middot;&nbsp;<a href="${safeUrl(unsubscribeUrl)}" style="color:${colors.faint};text-decoration:underline;">Unsubscribe</a>` : ''}
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
};

/** Strip HTML to a readable text/plain alternative (improves deliverability). */
export const htmlToText = (html: string): string =>
    html
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<head[\s\S]*?<\/head>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|h1|h2|h3|tr|div|table)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#8199;|&#65279;|&#847;|&middot;|&times;/g, ' ')
        .replace(/[ \t]+/g, ' ')
        // Trim each line *before* collapsing blank runs — whitespace-only lines
        // from the table markup are not empty until they have been trimmed.
        .split('\n')
        .map((line) => line.trim())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
