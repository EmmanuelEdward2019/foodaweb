# Payment Processing Integration Plan

This document outlines the implementation plan for integrating payment processing capabilities into the Fooda application.

## Supported Payment Methods

1. **Credit/Debit Cards** - Primary payment method
2. **Digital Wallets** - Apple Pay, Google Pay, Samsung Pay
3. **Bank Transfers** - ACH, SEPA, etc.
4. **Buy Now, Pay Later** - Klarna, Afterpay (optional)
5. **Cash on Delivery** - For local markets

## Payment Providers

### Primary Options

1. **Stripe** - Recommended for global reach
2. **PayPal** - Widely recognized and trusted
3. **Razorpay** - Popular in India and Southeast Asia
4. **Square** - Good for US-based businesses

## Implementation Architecture

### Backend Processing (Supabase Edge Functions)

#### Payment Processing Function
```typescript
// supabase/functions/process-payment/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno&no-check';

serve(async (req) => {
  try {
    // Initialize Stripe
    const stripe = Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    
    // Parse request
    const { order_id, payment_method_id, amount } = await req.json();
    
    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      payment_method: payment_method_id,
      confirm: true,
      return_url: 'https://your-app.com/payment-complete',
    });
    
    // Update order status in database
    const supabaseClient = createClient(/* ... */);
    await supabaseClient
      .from('orders')
      .update({ 
        payment_status: 'completed',
        payment_intent_id: paymentIntent.id
      })
      .eq('id', order_id);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        paymentIntentId: paymentIntent.id 
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
});
```

### Frontend Integration

#### Flutter Mobile App

##### Dependencies
```yaml
dependencies:
  flutter_stripe: ^9.0.0
  pay: ^1.0.0
```

##### Payment Screen Implementation
```dart
import 'package:flutter_stripe/flutter_stripe.dart';
import 'package:pay/pay.dart';

class PaymentScreen extends StatefulWidget {
  final double amount;
  final String orderId;
  
  PaymentScreen({required this.amount, required this.orderId});
  
  @override
  _PaymentScreenState createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  late Stripe _stripe;
  
  @override
  void initState() {
    super.initState();
    _stripe = Stripe.instance;
    _stripe.initPaymentSheet(
      paymentSheetParameters: SetupPaymentSheetParameters(
        applePay: true,
        googlePay: true,
        style: ThemeMode.light,
        merchantCountryCode: 'US',
        merchantDisplayName: 'Fooda',
        customerId: 'customer_id',
        paymentIntentClientSecret: 'payment_intent_client_secret',
      ),
    );
  }
  
  Future<void> _makePayment() async {
    try {
      await _stripe.presentPaymentSheet();
      // Payment successful - update UI and navigate
    } on Exception catch (e) {
      // Handle error
    }
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Payment')),
      body: Center(
        child: ElevatedButton(
          onPressed: _makePayment,
          child: Text('Pay \$${widget.amount}'),
        ),
      ),
    );
  }
}
```

#### React Web Dashboard

##### Stripe Integration
```bash
npm install @stripe/react-stripe-js @stripe/stripe-js
```

```javascript
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

function CheckoutForm({ amount, orderId }) {
  const stripe = useStripe();
  const elements = useElements();
  
  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }
    
    const cardElement = elements.getElement(CardElement);
    
    const { paymentMethod, error } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
    });
    
    if (error) {
      console.error('[error]', error);
    } else {
      // Send paymentMethod.id to your server
      const response = await fetch('/functions/v1/process-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order_id: orderId,
          payment_method_id: paymentMethod.id,
          amount: amount,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Payment successful
      }
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <CardElement />
      <button type="submit" disabled={!stripe}>
        Pay ${amount}
      </button>
    </form>
  );
}

function PaymentPage({ amount, orderId }) {
  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm amount={amount} orderId={orderId} />
    </Elements>
  );
}
```

## Security Considerations

### PCI Compliance
- Never store credit card numbers
- Use tokenization for sensitive data
- Implement 3D Secure for fraud prevention
- Regularly scan for vulnerabilities

### Data Protection
- Encrypt payment data in transit and at rest
- Implement proper authentication and authorization
- Log security events for monitoring
- Regular security audits

## Error Handling

### Common Payment Errors
1. **Card declined** - Insufficient funds, expired card
2. **Authentication failed** - 3D Secure issues
3. **Processing errors** - Network issues, timeouts
4. **Fraud detection** - Suspicious activity

### Retry Logic
```javascript
async function processPaymentWithRetry(paymentData, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await processPayment(paymentData);
      return result;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}
```

## Refund Management

### Automated Refunds
```typescript
// supabase/functions/process-refund/index.ts
async function processRefund(paymentIntentId: string, amount?: number) {
  const stripe = Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
  
  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount: amount ? Math.round(amount * 100) : undefined,
  });
  
  return refund;
}
```

## Subscription Management

For recurring payments (if needed for vendor subscriptions):

```typescript
// Create subscription
const subscription = await stripe.subscriptions.create({
  customer: 'customer_id',
  items: [{ price: 'price_id' }],
  payment_behavior: 'default_incomplete',
  expand: ['latest_invoice.payment_intent'],
});
```

## Testing

### Test Cards
- Visa: 4242 4242 4242 4242
- Mastercard: 5555 5555 5555 4444
- Amex: 3782 822463 10005

### Webhook Testing
```bash
# Use Stripe CLI for local webhook testing
stripe listen --forward-to localhost:3000/webhooks/stripe
```

## Implementation Steps

### Phase 1: Basic Payment Processing
1. Set up payment provider accounts
2. Implement basic card payment
3. Add payment status tracking

### Phase 2: Advanced Features
1. Add digital wallets (Apple Pay, Google Pay)
2. Implement subscription management
3. Add refund functionality

### Phase 3: Optimization
1. Implement fraud detection
2. Add analytics and reporting
3. Optimize for conversion rates

## Cost Considerations

Payment processing fees vary by provider:
- Stripe: 2.9% + $0.30 per transaction
- PayPal: 2.9% + $0.30 per transaction
- Square: 2.6% + $0.10 per transaction

Consider volume discounts and international transaction fees.

## Compliance

Ensure compliance with:
- PCI DSS standards
- Local financial regulations
- Tax requirements
- Consumer protection laws