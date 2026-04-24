# Supabase Setup Guide for Fooda Application

This guide walks you through setting up the Supabase backend for the Fooda multivendor food ordering application.

## Prerequisites

1. A Supabase account (free tier available at https://supabase.com/)
2. Basic understanding of SQL and database concepts

## Step-by-Step Setup

### 1. Create a New Supabase Project

1. Go to https://app.supabase.com/
2. Click "New Project"
3. Enter project details:
   - Name: `fooda-app`
   - Database password: Set a strong password
   - Region: Select the region closest to your users
4. Click "Create new project"
5. Wait for the project to be provisioned (usually takes 1-2 minutes)

### 2. Enable UUID Extension

1. In your Supabase dashboard, go to the SQL Editor
2. Run the following query:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 3. Create Database Tables

1. In the SQL Editor, copy and paste the contents of [supabase-schema.sql](supabase-schema.sql)
2. Click "Run" to execute the schema creation script
3. Verify that all tables were created successfully

### 4. Insert Sample Data (Optional)

1. In the SQL Editor, copy and paste the contents of [sample-data.sql](sample-data.sql)
2. Click "Run" to populate the database with sample data

### 5. Configure Authentication

1. Go to the "Authentication" section in the Supabase dashboard
2. Navigate to "Settings" → "Auth Settings"
3. Under "SITE URL", enter your application's URL (for development, you can use http://localhost:3000)
4. Under "Redirect URLs", add:
   - http://localhost:3000/**
   - https://your-domain.com/**

### 6. Set Up Storage (Optional)

If you plan to store images (vendor logos, menu item photos, etc.):

1. Go to the "Storage" section
2. Create a new bucket named `fooda-images`
3. Set the bucket to public for read access
4. Configure appropriate permissions

### 7. Configure Environment Variables

In your frontend applications, you'll need to set the following environment variables:

```
REACT_APP_SUPABASE_URL=your-project-url.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

You can find these values in:
1. Project Settings → API
2. Copy the "Project URL" and "anon public" key

### 8. Test the Setup

1. Go to the "Table Editor" to verify all tables were created
2. Check the "Authentication" → "Users" section to ensure auth is working
3. Try inserting a test record in one of the tables

## Connecting to Your Frontend Applications

### React Applications

1. Install the Supabase client library:

```bash
npm install @supabase/supabase-js
```

2. Create a Supabase client instance:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Flutter Applications

1. Add the Supabase Flutter package to your pubspec.yaml:

```yaml
dependencies:
  supabase_flutter: ^1.10.0
```

2. Initialize Supabase in your main.dart:

```dart
import 'package:supabase_flutter/supabase_flutter.dart';

void main() async {
  await Supabase.initialize(
    url: 'YOUR_SUPABASE_URL',
    anonKey: 'YOUR_SUPABASE_ANON_KEY',
  );
  runApp(MyApp());
}
```

## Troubleshooting

### Common Issues

1. **RLS Errors**: Make sure all policies are correctly implemented and RLS is enabled on all tables
2. **Authentication Failures**: Verify your anon key and project URL are correct
3. **Permission Denied**: Check that the user has the appropriate role and policies allow the operation

### Useful Queries for Debugging

Check if RLS is enabled on a table:
```sql
SELECT tablename, relrowsecurity 
FROM pg_tables 
WHERE tablename = 'your_table_name';
```

View existing policies on a table:
```sql
SELECT * FROM pg_policy WHERE polrelid = 'your_table_name'::regclass;
```

## Next Steps

1. Implement the Supabase Edge Functions for business logic
2. Set up real-time subscriptions for order tracking
3. Configure storage buckets for image uploads
4. Set up custom SMTP for email notifications
5. Configure third-party authentication providers (Google, Facebook, etc.)

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime)
- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)