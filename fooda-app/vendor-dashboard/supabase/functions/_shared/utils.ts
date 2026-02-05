// Shared utilities for Supabase Edge Functions

// CORS headers for responses
export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const createResponse = (data: any, status = 200) => {
    return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
    });
};

// Error response helper
export const createErrorResponse = (message: string, status = 400) => {
    return createResponse({ error: message }, status);
};

// Validate required fields
export const validateRequiredFields = (obj: any, requiredFields: string[]) => {
    for (const field of requiredFields) {
        if (!obj[field]) {
            return `Missing required field: ${field}`;
        }
    }
    return null;
};

// Generate order number
export const generateOrderNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `ORD-${year}${month}${day}-${random}`;
};

// Calculate order totals
export const calculateOrderTotals = (items: any[], deliveryFee = 0, taxRate = 0.08) => {
    const subtotal = items.reduce((sum, item) => sum + (item.price_per_unit * item.quantity), 0);
    const taxAmount = subtotal * taxRate;
    const totalAmount = subtotal + taxAmount + deliveryFee;

    return {
        subtotal: Number(subtotal.toFixed(2)),
        taxAmount: Number(taxAmount.toFixed(2)),
        deliveryFee: Number(deliveryFee.toFixed(2)),
        totalAmount: Number(totalAmount.toFixed(2))
    };
};