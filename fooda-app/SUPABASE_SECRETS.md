# Supabase Edge Function Secrets

This document lists the sensitive credentials that should be stored in Supabase Edge Function secrets rather than in .env files.

## Secrets to Store in Supabase

### 1. Supabase Credentials
```
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 2. Payment Processing Secrets
```
PAYSTACK_SECRET_KEY=your_paystack_secret_key
```

### 3. Communication Services
```
TWILIO_AUTH_TOKEN=your_twilio_auth_token
EMAIL_PASSWORD=your_email_password
```

### 4. Social Login Secrets
```
GOOGLE_CLIENT_SECRET=your_google_client_secret
FACEBOOK_APP_SECRET=your_facebook_app_secret
```

### 5. Database Credentials (if used)
```
DB_PASSWORD=your_db_password
```

### 6. Monitoring & Error Tracking
```
SENTRY_DSN=your_sentry_dsn
```

## How to Add Secrets to Supabase

1. Go to your Supabase project dashboard
2. Navigate to Settings → API
3. Scroll down to the "Edge Functions" section
4. Click "Add Secret" for each sensitive credential
5. Reference secrets in your Edge Functions using:
   ```typescript
   Deno.env.get('SECRET_NAME')
   ```

## Example Edge Function Using Paystack Secrets
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Paystack from 'https://esm.sh/paystack-api@3.0.0';

serve(async (_req) => {
  // Securely access the Paystack secret key
  const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
  const paystack = new Paystack(paystackSecretKey);
  
  // Process payment securely
  // ...
  
  return new Response(JSON.stringify({ success: true }));
});
```

## Security Benefits

1. **Encrypted Storage**: Secrets are encrypted at rest
2. **Access Control**: Only Edge Functions can access these secrets
3. **No Source Control Risk**: Secrets never touch your repository
4. **Environment Separation**: Different secrets for different environments
5. **Audit Trail**: Supabase logs secret access

## Best Practices

1. **Regular Rotation**: Rotate secrets periodically
2. **Least Privilege**: Give secrets only necessary permissions
3. **Monitoring**: Monitor secret access logs
4. **Documentation**: Keep this document updated with all secrets
5. **Environment Separation**: Use different secrets for dev/staging/prod