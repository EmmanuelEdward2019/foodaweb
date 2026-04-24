# Supabase Edge Functions Deployment

This directory contains the Edge Functions that you need to deploy to Supabase.

## Files

1. `create-order.ts` - Creates new orders in the database
2. `update-order-status.ts` - Updates the status of existing orders
3. `process-payment.ts` - Processes payments using Paystack

## Deployment Instructions

1. Make sure you have the Supabase CLI installed:
   ```bash
   npm install -g supabase
   ```

2. Login to your Supabase account:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

4. Deploy the functions:
   ```bash
   supabase functions deploy create-order --project-ref YOUR_PROJECT_REF
   supabase functions deploy update-order-status --project-ref YOUR_PROJECT_REF
   supabase functions deploy process-payment --project-ref YOUR_PROJECT_REF
   ```

## Required Environment Variables

Make sure you have set the following environment variables in your Supabase project:

1. `SUPABASE_SERVICE_ROLE_KEY` - Found in your Supabase project settings
2. `PAYSTACK_SECRET_KEY` - Your Paystack secret key

You can set these in your Supabase dashboard under Settings → API → Edge Functions.

## Testing

After deployment, you can test your functions using:

```bash
supabase functions serve
```

This will start a local server where you can test your functions before deploying.