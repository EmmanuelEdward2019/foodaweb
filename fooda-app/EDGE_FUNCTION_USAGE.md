# Using Edge Functions in Your Frontend Applications

This document explains how to call the Supabase Edge Functions from your frontend applications.

## Prerequisites

1. Supabase project set up
2. Edge Functions deployed
3. Supabase JavaScript client installed in your frontend

## Installation

Install the Supabase client in your frontend project:

```bash
npm install @supabase/supabase-js
```

## Configuration

Initialize the Supabase client in your application:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

## Calling Edge Functions

### 1. Create Order Function

Call the `create-order` function when a user submits an order:

```javascript
async function createOrder(orderData) {
  try {
    const { data, error } = await supabase.functions.invoke('create-order', {
      body: {
        vendor_id: orderData.vendorId,
        delivery_address: orderData.deliveryAddress,
        items: orderData.items,
        notes: orderData.notes,
        delivery_fee: orderData.deliveryFee
      }
    })

    if (error) {
      console.error('Error creating order:', error)
      throw error
    }

    console.log('Order created:', data.order)
    return data.order
  } catch (error) {
    console.error('Failed to create order:', error)
    throw error
  }
}

// Usage example
const orderData = {
  vendorId: 'vendor-uuid',
  deliveryAddress: {
    line1: '123 Main St',
    city: 'San Francisco',
    state: 'CA',
    zip: '94105'
  },
  items: [
    {
      menu_item_id: 'menu-item-uuid',
      quantity: 2,
      price_per_unit: 12.99,
      special_instructions: 'Extra cheese'
    }
  ],
  notes: 'Please ring doorbell',
  deliveryFee: 3.99
}

createOrder(orderData)
  .then(order => console.log('Order created:', order))
  .catch(error => console.error('Failed to create order:', error))
```

### 2. Update Order Status Function

Call the `update-order-status` function when updating an order status:

```javascript
async function updateOrderStatus(orderId, status) {
  try {
    const { data, error } = await supabase.functions.invoke('update-order-status', {
      body: {
        order_id: orderId,
        status: status
      }
    })

    if (error) {
      console.error('Error updating order status:', error)
      throw error
    }

    console.log('Order status updated:', data.order)
    return data.order
  } catch (error) {
    console.error('Failed to update order status:', error)
    throw error
  }
}

// Usage examples
// Vendor confirms an order
updateOrderStatus('order-uuid', 'confirmed')

// Delivery person picks up an order
updateOrderStatus('order-uuid', 'picked_up')

// Customer cancels a pending order
updateOrderStatus('order-uuid', 'cancelled')
```

### 3. Error Handling

Properly handle errors from Edge Functions:

```javascript
async function callEdgeFunction(functionName, body) {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, { body })

    if (error) {
      // Handle different types of errors
      switch (error.status) {
        case 400:
          console.error('Bad Request:', error.message)
          break
        case 401:
          console.error('Unauthorized:', error.message)
          // Redirect to login
          break
        case 403:
          console.error('Forbidden:', error.message)
          // Show permission error
          break
        case 404:
          console.error('Not Found:', error.message)
          break
        case 500:
          console.error('Server Error:', error.message)
          // Show generic error message
          break
        default:
          console.error('Unknown Error:', error.message)
      }
      throw error
    }

    return data
  } catch (error) {
    console.error(`Failed to call ${functionName}:`, error)
    throw error
  }
}
```

## React Hook Example

Create a custom React hook for calling Edge Functions:

```javascript
import { useState } from 'react'
import { supabase } from '../supabaseClient'

export function useEdgeFunction() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const callFunction = async (functionName, body) => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: funcError } = await supabase.functions.invoke(functionName, { body })

      if (funcError) {
        setError(funcError)
        throw funcError
      }

      setLoading(false)
      return data
    } catch (err) {
      setLoading(false)
      setError(err)
      throw err
    }
  }

  return { callFunction, loading, error }
}

// Usage in a component
function OrderForm() {
  const { callFunction, loading, error } = useEdgeFunction()
  const [order, setOrder] = useState(null)

  const handleSubmit = async (orderData) => {
    try {
      const result = await callFunction('create-order', orderData)
      setOrder(result.order)
    } catch (err) {
      console.error('Failed to create order:', err)
    }
  }

  if (loading) return <div>Creating order...</div>
  if (error) return <div>Error: {error.message}</div>
  if (order) return <div>Order created: {order.order_number}</div>

  return (
    // Your order form JSX
    <form onSubmit={(e) => {
      e.preventDefault()
      const orderData = {
        // Collect form data
      }
      handleSubmit(orderData)
    }}>
      {/* Form fields */}
    </form>
  )
}
```

## Flutter Integration

For Flutter applications, use the Supabase Flutter package:

```dart
import 'package:supabase_flutter/supabase_flutter.dart';

final supabase = Supabase.instance.client;

// Call Edge Function
Future<Map<String, dynamic>> createOrder(Map<String, dynamic> orderData) async {
  try {
    final response = await supabase.functions.invoke(
      'create-order',
      body: orderData,
    );
    
    if (response.status == 200) {
      return response.data;
    } else {
      throw Exception('Function error: ${response.statusText}');
    }
  } catch (error) {
    print('Error creating order: $error');
    rethrow;
  }
}
```

## Best Practices

1. **Always handle errors** - Edge Functions can fail for various reasons
2. **Validate data before sending** - Reduce unnecessary function calls
3. **Use loading states** - Provide feedback during function execution
4. **Cache responses when appropriate** - Avoid redundant calls
5. **Log important events** - Help with debugging and monitoring
6. **Implement retry logic** - Handle temporary failures gracefully
7. **Secure sensitive operations** - Use proper authentication and authorization