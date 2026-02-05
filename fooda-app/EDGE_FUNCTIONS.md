# Supabase Edge Functions Implementation Guide

This document explains how to implement Supabase Edge Functions for your Fooda multivendor food ordering application.

## Overview

Edge Functions allow you to run server-side logic close to your users, providing low-latency execution. For the Fooda application, we'll implement several key functions:

1. `create-order` - Handles order creation and validation
2. `update-order-status` - Manages order status transitions
3. `send-notifications` - Sends push/email notifications
4. `process-payment` - Handles payment processing integrations

## Prerequisites

1. Supabase CLI installed (`npm install -g supabase`)
2. A Supabase project created
3. Supabase project linked to your local environment

## Directory Structure

```
supabase/
└── functions/
    ├── _shared/
    │   └── utils.ts
    ├── create-order/
    │   └── index.ts
    ├── update-order-status/
    │   └── index.ts
    ├── send-notifications/
    │   └── index.ts
    └── process-payment/
        └── index.ts
```

## Implementation Details

### 1. Shared Utilities (`_shared/utils.ts`)

Create reusable functions that can be imported by multiple Edge Functions:

```typescript
// CORS headers
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Response helpers
export const createResponse = (data: any, status = 200) => {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
};

export const createErrorResponse = (message: string, status = 400) => {
  return createResponse({ error: message }, status);
};

// Validation helpers
export const validateRequiredFields = (obj: any, requiredFields: string[]) => {
  for (const field of requiredFields) {
    if (!obj[field]) {
      return `Missing required field: ${field}`;
    }
  }
  return null;
};

// Business logic helpers
export const generateOrderNumber = () => {
  // Implementation for generating unique order numbers
};

export const calculateOrderTotals = (items: any[], deliveryFee = 0, taxRate = 0.08) => {
  // Implementation for calculating order totals
};
```

### 2. Create Order Function (`create-order/index.ts`)

This function handles the creation of new orders:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/utils.ts";
import { generateOrderNumber, calculateOrderTotals } from "../_shared/utils.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get user session
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
      return createResponse({ error: 'Unauthorized' }, 401);
    }

    // Parse request data
    const { vendor_id, delivery_address, items, notes, delivery_fee } = await req.json();

    // Validate required fields
    if (!vendor_id || !delivery_address || !items || items.length === 0) {
      return createResponse(
        { error: 'Missing required fields' }, 
        400
      );
    }

    // Generate order number and calculate totals
    const order_number = generateOrderNumber();
    const totals = calculateOrderTotals(items, delivery_fee);

    // Insert order record
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .insert({
        customer_id: session.user.id,
        vendor_id,
        order_number,
        delivery_address,
        delivery_fee: totals.deliveryFee,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        total_amount: totals.totalAmount,
        notes,
        status: 'pending'
      })
      .select()
      .single();

    if (orderError) {
      return createResponse({ error: orderError.message }, 500);
    }

    // Insert order items
    const orderItems = items.map((item: any) => ({
      order_id: order.id,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      price_per_unit: item.price_per_unit,
      total_price: item.price_per_unit * item.quantity,
      special_instructions: item.special_instructions
    }));

    const { error: itemsError } = await supabaseClient
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      // Rollback order if items insertion fails
      await supabaseClient.from('orders').delete().eq('id', order.id);
      return createResponse({ error: itemsError.message }, 500);
    }

    return createResponse({ order }, 201);

  } catch (error) {
    return createResponse({ error: error.message }, 500);
  }
});
```

### 3. Update Order Status Function (`update-order-status/index.ts`)

This function manages order status transitions with proper authorization:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/utils.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get user session
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
      return createResponse({ error: 'Unauthorized' }, 401);
    }

    // Parse request data
    const { order_id, status } = await req.json();

    // Validate inputs
    const validStatuses = [
      'pending', 'confirmed', 'preparing', 'ready_for_pickup', 
      'picked_up', 'delivered', 'cancelled'
    ];

    if (!validStatuses.includes(status)) {
      return createResponse(
        { error: `Invalid status. Valid statuses: ${validStatuses.join(', ')}` }, 
        400
      );
    }

    // Fetch order with related data
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select(`
        *,
        vendor:vendors(owner_id),
        delivery_person:users(id)
      `)
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      return createResponse({ error: 'Order not found' }, 404);
    }

    // Check permissions based on user role
    const userRole = session.user.role || 'customer';
    let hasPermission = false;

    switch (userRole) {
      case 'admin':
        hasPermission = true;
        break;
      case 'vendor':
        hasPermission = order.vendor.owner_id === session.user.id;
        break;
      case 'delivery_person':
        hasPermission = order.delivery_person_id === session.user.id;
        break;
      case 'customer':
        // Customers can only cancel pending orders
        hasPermission = status === 'cancelled' && 
                       order.status === 'pending' && 
                       order.customer_id === session.user.id;
        break;
    }

    if (!hasPermission) {
      return createResponse({ error: 'Insufficient permissions' }, 403);
    }

    // Update order status
    const { data: updatedOrder, error: updateError } = await supabaseClient
      .from('orders')
      .update({ 
        status,
        ...(status === 'picked_up' && { actual_delivery_time: new Date().toISOString() })
      })
      .eq('id', order_id)
      .select()
      .single();

    if (updateError) {
      return createResponse({ error: updateError.message }, 500);
    }

    return createResponse({ order: updatedOrder });

  } catch (error) {
    return createResponse({ error: error.message }, 500);
  }
});
```

### 4. Send Notifications Function (`send-notifications/index.ts`)

This function handles sending notifications to users:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // Implementation for sending notifications via:
  // - Email (SMTP or email service provider)
  // - SMS (Twilio or similar)
  // - Push notifications (Firebase, etc.)
  
  // This function would be triggered by database events or called directly
});
```

### 5. Process Payment Function (`process-payment/index.ts`)

This function integrates with payment processors:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // Implementation for processing payments via:
  // - Stripe
  // - PayPal
  // - Other payment gateways
  
  // This function would handle:
  // - Payment authorization
  // - Transaction recording
  // - Error handling
});
```

## Deployment

To deploy your Edge Functions:

1. Login to Supabase CLI:
   ```bash
   supabase login
   ```

2. Link your project:
   ```bash
   supabase link --project-ref your-project-ref
   ```

3. Deploy functions:
   ```bash
   supabase functions deploy create-order --project-ref your-project-ref
   supabase functions deploy update-order-status --project-ref your-project-ref
   ```

## Testing

Test your functions locally before deploying:

```bash
supabase functions serve --env-file .env.local
```

## Security Considerations

1. Always validate user permissions
2. Use service role keys only when necessary
3. Sanitize all input data
4. Implement rate limiting for public endpoints
5. Log security events for monitoring

## Best Practices

1. Keep functions small and focused
2. Use shared utilities for common code
3. Implement proper error handling
4. Log important events for debugging
5. Use environment variables for configuration
6. Validate all input data
7. Implement proper CORS headers