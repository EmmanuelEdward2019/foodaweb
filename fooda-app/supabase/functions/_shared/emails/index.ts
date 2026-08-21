// Entry point for Fooda transactional email.
//
//   import { sendTemplateEmail } from '../_shared/emails/index.ts';
//
//   await sendTemplateEmail({
//     template: 'order_placed',
//     to: customer.email,
//     data: { orderId, orderNumber, vendorName, items, totals },
//     idempotencyKey: `order-placed-${orderId}`,
//   });

export * from './layout.ts';
export * from './templates.ts';
export * from './resend.ts';

import { templates } from './templates.ts';
import type { TemplateId, RenderedEmail } from './templates.ts';
import { sendEmail } from './resend.ts';
import type { SendEmailOptions, SendEmailResult } from './resend.ts';

export interface SendTemplateOptions extends Omit<SendEmailOptions, 'subject' | 'html' | 'text'> {
    template: TemplateId;
    // deno-lint-ignore no-explicit-any
    data: any;
    /** Override the template's subject line. */
    subject?: string;
}

/** Render a template and hand it to Resend in one call. */
export const sendTemplateEmail = async (options: SendTemplateOptions): Promise<SendEmailResult> => {
    const { template, data, subject, ...sendOptions } = options;

    const render = templates[template] as ((d: unknown) => RenderedEmail) | undefined;
    if (!render) {
        console.error('[email] unknown template:', template);
        return { success: false, error: `Unknown email template: ${template}` };
    }

    let rendered: RenderedEmail;
    try {
        rendered = render(data);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[email] render failed for', template, message);
        return { success: false, error: `Render failed: ${message}` };
    }

    return await sendEmail({
        ...sendOptions,
        subject: subject || rendered.subject,
        html: rendered.html,
        text: rendered.text,
        tags: [{ name: 'template', value: template }, ...(sendOptions.tags || [])],
    });
};

/** Render without sending — useful for previews and tests. */
export const renderTemplate = (template: TemplateId, data: unknown): RenderedEmail => {
    const render = templates[template] as (d: unknown) => RenderedEmail;
    return render(data);
};
