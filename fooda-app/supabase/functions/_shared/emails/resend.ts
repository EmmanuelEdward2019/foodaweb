// Thin Resend client for Supabase Edge Functions.
//
// Deliberately dependency-free: Resend's REST API is a single POST, and pulling
// an npm SDK into every function costs cold-start time we don't need to spend.
//
// Required secret:  RESEND_API_KEY
// Recommended:      RESEND_FROM_EMAIL, RESEND_FROM_NAME, RESEND_REPLY_TO

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

const env = (key: string): string | undefined => Deno.env.get(key);

export interface SendEmailOptions {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    /** Overrides RESEND_FROM_EMAIL / RESEND_FROM_NAME. */
    from?: string;
    replyTo?: string;
    cc?: string | string[];
    bcc?: string | string[];
    /** Resend tags — filterable in the dashboard. Values: a-z, 0-9, _ and -. */
    tags?: { name: string; value: string }[];
    /**
     * Safe-retry key. Resend de-duplicates identical keys for 24h, so pass
     * something stable per event (e.g. `order-delivered-<order_id>`) to avoid
     * double sends when a function retries.
     */
    idempotencyKey?: string;
    headers?: Record<string, string>;
}

export interface SendEmailResult {
    success: boolean;
    id?: string;
    error?: string;
    /** true when the send failed for a reason worth retrying (5xx / 429). */
    retryable?: boolean;
    skipped?: boolean;
}

const isConfigured = (): boolean => Boolean(env('RESEND_API_KEY'));

const defaultFrom = (): string => {
    const address = env('RESEND_FROM_EMAIL') || 'orders@fooda.com';
    const name = env('RESEND_FROM_NAME') || 'Fooda';
    return `${name} <${address}>`;
};

/** Resend tag values only accept [a-zA-Z0-9_-]. */
const sanitizeTagValue = (value: string): string =>
    String(value).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 256);

/**
 * Send one email through Resend.
 *
 * Never throws — email is a side effect of order flows and must not fail an
 * order. Inspect the returned result and log it instead.
 */
export const sendEmail = async (options: SendEmailOptions): Promise<SendEmailResult> => {
    const apiKey = env('RESEND_API_KEY');
    if (!apiKey) {
        console.warn('[email] RESEND_API_KEY not set — skipping send to', options.to);
        return { success: false, skipped: true, error: 'RESEND_API_KEY not configured' };
    }

    const recipients = Array.isArray(options.to) ? options.to.filter(Boolean) : [options.to].filter(Boolean);
    if (recipients.length === 0) {
        return { success: false, skipped: true, error: 'No recipient address' };
    }

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
    };
    if (options.idempotencyKey) {
        headers['Idempotency-Key'] = options.idempotencyKey.slice(0, 256);
    }

    const payload: Record<string, unknown> = {
        from: options.from || defaultFrom(),
        to: recipients,
        subject: options.subject,
        html: options.html,
    };
    if (options.text) payload.text = options.text;
    const replyTo = options.replyTo || env('RESEND_REPLY_TO');
    if (replyTo) payload.reply_to = replyTo;
    if (options.cc) payload.cc = options.cc;
    if (options.bcc) payload.bcc = options.bcc;
    if (options.headers) payload.headers = options.headers;
    if (options.tags?.length) {
        payload.tags = options.tags.map((t) => ({
            name: sanitizeTagValue(t.name),
            value: sanitizeTagValue(t.value),
        }));
    }

    try {
        const res = await fetch(RESEND_ENDPOINT, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        });

        const body = await res.json().catch(() => ({}));

        if (!res.ok) {
            const message = body?.message || body?.error?.message || `Resend responded ${res.status}`;
            console.error('[email] send failed', { status: res.status, message, to: recipients });
            return { success: false, error: message, retryable: res.status === 429 || res.status >= 500 };
        }

        return { success: true, id: body?.id };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[email] send threw', message);
        return { success: false, error: message, retryable: true };
    }
};

/**
 * Send up to 100 emails in one call (Resend batch endpoint).
 * Batch does not support attachments, tags or idempotency keys.
 */
export const sendBatch = async (
    messages: Pick<SendEmailOptions, 'to' | 'subject' | 'html' | 'text' | 'from' | 'replyTo'>[],
): Promise<SendEmailResult[]> => {
    const apiKey = env('RESEND_API_KEY');
    if (!apiKey) {
        return messages.map(() => ({ success: false, skipped: true, error: 'RESEND_API_KEY not configured' }));
    }
    if (messages.length === 0) return [];

    try {
        const res = await fetch(`${RESEND_ENDPOINT}/batch`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(
                messages.slice(0, 100).map((m) => ({
                    from: m.from || defaultFrom(),
                    to: Array.isArray(m.to) ? m.to : [m.to],
                    subject: m.subject,
                    html: m.html,
                    ...(m.text ? { text: m.text } : {}),
                    ...(m.replyTo || env('RESEND_REPLY_TO') ? { reply_to: m.replyTo || env('RESEND_REPLY_TO') } : {}),
                })),
            ),
        });

        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            const message = body?.message || `Resend responded ${res.status}`;
            return messages.map(() => ({ success: false, error: message, retryable: res.status >= 500 }));
        }
        // deno-lint-ignore no-explicit-any
        return (body?.data || []).map((d: any) => ({ success: true, id: d?.id }));
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return messages.map(() => ({ success: false, error: message, retryable: true }));
    }
};

export const emailIsConfigured = isConfigured;
