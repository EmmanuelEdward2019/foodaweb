// Shared utilities for Supabase Edge Functions

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const createResponse = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status,
    });

export const createErrorResponse = (message: string, status = 400) =>
    createResponse({ error: message }, status);

export const validateRequiredFields = (obj: Record<string, unknown>, fields: string[]): string | null => {
    for (const field of fields) {
        if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
            return `Missing required field: ${field}`;
        }
    }
    return null;
};

export const generateOrderNumber = (): string => {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `ORD-${ymd}-${rand}`;
};

export interface OrderTotals {
    subtotal: number;
    taxAmount: number;
    deliveryFee: number;
    totalAmount: number;
}

// Accepts validated item prices (fetched from DB, not from client)
export const calculateOrderTotals = (
    items: { price: number; quantity: number }[],
    deliveryFee: number,
    taxRate: number
): OrderTotals => {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const taxAmount = subtotal * taxRate;
    const totalAmount = subtotal + taxAmount + deliveryFee;
    return {
        subtotal: Number(subtotal.toFixed(2)),
        taxAmount: Number(taxAmount.toFixed(2)),
        deliveryFee: Number(deliveryFee.toFixed(2)),
        totalAmount: Number(totalAmount.toFixed(2)),
    };
};
