# Fooda API Documentation for Mobile App Integration

## Overview
This document outlines all available APIs for the Fooda mobile application. All APIs are powered by Supabase and accessible via the Supabase client library.

## Supabase Configuration
```
URL: https://dukvrgupgtymxxbqpctq.supabase.co
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1a3ZyZ3VwZ3R5bXh4YnFwY3RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NjY1MTQsImV4cCI6MjA4MDQ0MjUxNH0._WUj92bMmPakzdA7dltor8ADGUhOlHExSKB4DRvugcg
```

## 1. Authentication APIs

### Sign Up (Customer)
```typescript
const { data, error } = await supabase.auth.signUp({
  email: string,
  password: string,
  options: {
    data: {
      role: 'customer',
      full_name: string
    }
  }
});
```

### Login
```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: string,
  password: string
});
```

### Logout
```typescript
const { error } = await supabase.auth.signOut();
```

### Get Current Session
```typescript
const { data: { session } } = await supabase.auth.getSession();
```

### Get Current User
```typescript
const { data: { user } } = await supabase.auth.getUser();
```

## 2. Vendor APIs

### Get All Active Vendors
```typescript
const { data, error } = await supabase
  .from('vendors')
  .select('*')
  .eq('is_active', true)
  .order('name');
```

### Get Vendor by ID
```typescript
const { data, error } = await supabase
  .from('vendors')
  .select('*')
  .eq('id', vendorId)
  .single();
```

### Search Vendors by Name
```typescript
const { data, error } = await supabase
  .from('vendors')
  .select('*')
  .ilike('name', `%${searchTerm}%`)
  .eq('is_active', true);
```

## 3. Menu APIs

### Get Vendor Menu Items
```typescript
const { data, error } = await supabase
  .from('menu_items')
  .select('*, menu_categories(*)')
  .eq('vendor_id', vendorId)
  .eq('is_available', true)
  .order('sort_order');
```

### Get Menu Categories
```typescript
const { data, error} = await supabase
  .from('menu_categories')
  .select('*')
  .eq('vendor_id', vendorId)
  .eq('is_active', true)
  .order('sort_order');
```

### Get Menu Item by ID
```typescript
const { data, error } = await supabase
  .from('menu_items')
  .select('*')
  .eq('id', itemId)
  .single();
```

## 4. Order APIs

### Create Order
```typescript
const { data, error } = await supabase
  .from('orders')
  .insert({
    customer_id: userId,
    vendor_id: vendorId,
    order_number: generateOrderNumber(),
    status: 'pending',
    subtotal: number,
    tax_amount: number,
    delivery_fee: number,
    total_amount: number,
    payment_method: 'card' | 'cash' | 'paypal' | 'wallet',
    payment_status: 'pending',
    delivery_address: jsonObject,
    delivery_latitude: number,
    delivery_longitude: number,
    notes: string
  })
  .select()
  .single();
```

### Create Order Items
```typescript
const { data, error } = await supabase
  .from('order_items')
  .insert(
    items.map(item => ({
      order_id: orderId,
      menu_item_id: item.id,
      quantity: item.quantity,
      price_per_unit: item.price,
      total_price: item.price * item.quantity,
      special_instructions: item.instructions
    }))
  );
```

### Get Customer Orders
```typescript
const { data, error } = await supabase
  .from('orders')
  .select('*, order_items(*, menu_items(*)), vendors(*)')
  .eq('customer_id', userId)
  .order('created_at', { ascending: false });
```

### Get Order by ID
```typescript
const { data, error } = await supabase
  .from('orders')
  .select('*, order_items(*, menu_items(*)), vendors(*)')
  .eq('id', orderId)
  .single();
```

### Update Order Status (Real-time tracking)
```typescript
const { data, error } = await supabase
  .from('orders')
  .update({ status: newStatus })
  .eq('id', orderId);
```

### Subscribe to Order Updates (Real-time)
```typescript
const subscription = supabase
  .channel('order_updates')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'orders',
      filter: `id=eq.${orderId}`
    },
    (payload) => {
      console.log('Order updated:', payload.new);
    }
  )
  .subscribe();
```

## 5. User Profile APIs

### Get User Profile
```typescript
const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId)
  .single();
```

### Update User Profile
```typescript
const { data, error } = await supabase
  .from('users')
  .update({
    full_name: string,
    phone: string,
    avatar_url: string
  })
  .eq('id', userId);
```

## 6. Address Management APIs

### Get User Addresses
```typescript
const { data, error } = await supabase
  .from('user_addresses')
  .select('*')
  .eq('user_id', userId)
  .order('is_default', { ascending: false });
```

### Add New Address
```typescript
const { data, error } = await supabase
  .from('user_addresses')
  .insert({
    user_id: userId,
    title: string,
    address_line1: string,
    address_line2: string,
    city: string,
    state: string,
    postal_code: string,
    country: string,
    latitude: number,
    longitude: number,
    is_default: boolean
  });
```

### Update Address
```typescript
const { data, error } = await supabase
  .from('user_addresses')
  .update({
    title: string,
    address_line1: string,
    // ... other fields
  })
  .eq('id', addressId)
  .eq('user_id', userId);
```

### Delete Address
```typescript
const { error } = await supabase
  .from('user_addresses')
  .delete()
  .eq('id', addressId)
  .eq('user_id', userId);
```

### Set Default Address
```typescript
// First, unset all defaults
await supabase
  .from('user_addresses')
  .update({ is_default: false })
  .eq('user_id', userId);

// Then set the new default
const { data, error } = await supabase
  .from('user_addresses')
  .update({ is_default: true })
  .eq('id', addressId)
  .eq('user_id', userId);
```

## 7. Payment APIs (Placeholder)

### Create Payment Intent
```typescript
// This will be implemented with payment gateway integration
// Placeholder structure:
const paymentIntent = {
  amount: totalAmount,
  currency: 'NGN',
  payment_method: 'card',
  customer_id: userId,
  order_id: orderId
};
```

### Confirm Payment
```typescript
const { data, error } = await supabase
  .from('orders')
  .update({
    payment_status: 'completed'
  })
  .eq('id', orderId);
```

## 8. Location-Based APIs

### Get Nearby Vendors (Using PostGIS)
```typescript
// Requires PostGIS extension and location columns in vendors table
const { data, error } = await supabase.rpc('nearby_vendors', {
  lat: userLatitude,
  long: userLongitude,
  radius_km: 10
});
```

### Calculate Delivery Fee
```typescript
// Custom function to calculate delivery fee based on distance
const { data, error } = await supabase.rpc('calculate_delivery_fee', {
  vendor_lat: vendorLatitude,
  vendor_long: vendorLongitude,
  customer_lat: customerLatitude,
  customer_long: customerLongitude
});
```

## 9. Reviews APIs

### Get Vendor Reviews
```typescript
const { data, error } = await supabase
  .from('reviews')
  .select('*, users(full_name, avatar_url)')
  .eq('vendor_id', vendorId)
  .eq('is_verified', true)
  .order('created_at', { ascending: false });
```

### Create Review
```typescript
const { data, error } = await supabase
  .from('reviews')
  .insert({
    customer_id: userId,
    vendor_id: vendorId,
    order_id: orderId,
    rating: number, // 1-5
    comment: string,
    is_verified: true
  });
```

## 10. Wallet APIs

### Get Wallet Balance
```typescript
const { data, error } = await supabase
  .from('wallet_transactions')
  .select('balance_after')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(1)
  .single();
```

### Get Wallet Transactions
```typescript
const { data, error } = await supabase
  .from('wallet_transactions')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
```

## Error Handling

All Supabase queries return an object with `data` and `error`. Always check for errors:

```typescript
const { data, error } = await supabase.from('table').select('*');

if (error) {
  console.error('Error:', error.message);
  // Handle error appropriately
  return;
}

// Use data
console.log(data);
```

## Row Level Security (RLS)

All tables have RLS enabled. Users can only access their own data unless explicitly allowed by policies. The mobile app must:

1. Always authenticate users before making requests
2. Include the auth token in all requests (handled automatically by Supabase client)
3. Handle permission errors gracefully

## Real-time Subscriptions

Supabase supports real-time subscriptions for live updates:

```typescript
const subscription = supabase
  .channel('custom-channel')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'orders' },
    (payload) => {
      console.log('Change received!', payload);
    }
  )
  .subscribe();

// Don't forget to unsubscribe when done
subscription.unsubscribe();
```

## Best Practices

1. **Caching**: Cache vendor and menu data locally to reduce API calls
2. **Pagination**: Use `.range(start, end)` for large datasets
3. **Optimistic Updates**: Update UI immediately, then sync with server
4. **Error Handling**: Always handle errors gracefully with user-friendly messages
5. **Loading States**: Show loading indicators during API calls
6. **Retry Logic**: Implement retry logic for failed requests
7. **Offline Support**: Consider implementing offline-first architecture

## Example: Complete Order Flow

```typescript
// 1. Get cart items (stored locally)
const cartItems = getLocalCart();

// 2. Calculate totals
const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
const tax = subtotal * 0.075; // 7.5% tax
const deliveryFee = 500; // Fixed or calculated
const total = subtotal + tax + deliveryFee;

// 3. Create order
const { data: order, error: orderError } = await supabase
  .from('orders')
  .insert({
    customer_id: user.id,
    vendor_id: vendorId,
    order_number: `ORD-${Date.now()}`,
    status: 'pending',
    subtotal,
    tax_amount: tax,
    delivery_fee: deliveryFee,
    total_amount: total,
    payment_method: 'card',
    payment_status: 'pending',
    delivery_address: selectedAddress,
    delivery_latitude: selectedAddress.latitude,
    delivery_longitude: selectedAddress.longitude
  })
  .select()
  .single();

if (orderError) throw orderError;

// 4. Create order items
const { error: itemsError } = await supabase
  .from('order_items')
  .insert(
    cartItems.map(item => ({
      order_id: order.id,
      menu_item_id: item.id,
      quantity: item.quantity,
      price_per_unit: item.price,
      total_price: item.price * item.quantity,
      special_instructions: item.instructions
    }))
  );

if (itemsError) throw itemsError;

// 5. Process payment (integrate with payment gateway)
// ... payment processing logic

// 6. Update payment status
await supabase
  .from('orders')
  .update({ payment_status: 'completed' })
  .eq('id', order.id);

// 7. Clear cart
clearLocalCart();

// 8. Navigate to order tracking
navigateToOrderTracking(order.id);
```

## Support

For any API-related questions or issues, refer to the Supabase documentation at https://supabase.com/docs
