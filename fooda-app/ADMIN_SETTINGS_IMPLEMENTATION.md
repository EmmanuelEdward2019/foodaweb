# Admin Settings Implementation

## ✅ What Was Done

### 1. Created Platform Settings Table
- **File**: `supabase/migrations/20260102_platform_settings.sql`
- **Table**: `platform_settings`
- **Features**:
  - Stores all platform configuration settings
  - Admin-only access via RLS policies
  - Automatic timestamp updates
  - Default settings pre-populated

### 2. Updated Admin Dashboard
- **File**: `src/pages/admin/AdminDashboard.tsx`
- **Features**:
  - Fetches settings from database
  - "Edit Settings" button
  - Inline editing for all settings
  - Save/Cancel functionality
  - Real-time updates

### 3. Editable Settings
The following settings can now be edited by admins:

**Platform Settings:**
- Delivery Fee (₦)
- Tax Rate (%)
- Commission Rate (%)
- Minimum Order Amount (₦)

**Contact Information:**
- Support Email
- Support Phone

## 🚀 How to Apply the Migration

### Option 1: Using Supabase CLI (Recommended)
```bash
# Navigate to the project directory
cd c:\Users\USER\Desktop\Fooda\fooda-app

# Run the migration
supabase db push
```

### Option 2: Manual SQL Execution
1. Go to your Supabase Dashboard: https://dukvrgupgtymxxbqpctq.supabase.co
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/20260102_platform_settings.sql`
4. Paste and execute the SQL

### Option 3: Using Supabase Studio
1. Open Supabase Studio
2. Go to **SQL Editor**
3. Create a new query
4. Paste the migration SQL
5. Run the query

## 📝 Migration SQL Summary

The migration creates:
1. **Table**: `platform_settings` with columns:
   - `id` (UUID, primary key)
   - `setting_key` (TEXT, unique)
   - `setting_value` (TEXT)
   - `setting_type` (TEXT: string/number/boolean/json)
   - `description` (TEXT)
   - `updated_at` (TIMESTAMP)
   - `updated_by` (UUID, references users)

2. **RLS Policies**:
   - Only admins can view settings
   - Only admins can update settings
   - Only admins can insert settings

3. **Default Settings**:
   - delivery_fee: 500
   - tax_rate: 7.5
   - commission_rate: 15
   - min_order_amount: 1000
   - max_delivery_distance: 10
   - platform_name: Fooda
   - support_email: support@fooda.com
   - support_phone: +234-XXX-XXX-XXXX

4. **Triggers**:
   - Auto-update timestamp on changes
   - Track who made the update

## 🎯 How to Use

### As an Admin:
1. Login to admin dashboard
2. Go to **Settings** tab
3. Click **"Edit Settings"** button
4. Modify any values
5. Click **"Save Changes"** to apply
6. Or click **"Cancel"** to discard changes

### Settings Are Used By:
- **Orders**: Tax rate, delivery fee calculations
- **Vendors**: Commission rate for payouts
- **Mobile App**: Contact information, platform name
- **Business Logic**: Minimum order validation

## 🔄 Future Enhancements

You can easily add more settings by:
1. Inserting new rows into `platform_settings` table
2. Adding corresponding fields in the admin dashboard UI

Example:
```sql
INSERT INTO platform_settings (setting_key, setting_value, setting_type, description) VALUES
  ('max_order_items', '50', 'number', 'Maximum items per order'),
  ('enable_cod', 'true', 'boolean', 'Enable cash on delivery');
```

## ✨ Benefits

1. **No Code Changes Needed**: Update settings without redeploying
2. **Admin Control**: Full control over platform parameters
3. **Audit Trail**: Track who changed what and when
4. **Type Safety**: Settings have defined types
5. **Mobile App Ready**: Settings accessible via API

## 📱 API Access for Mobile App

Mobile apps can fetch settings:
```typescript
const { data: settings } = await supabase
  .from('platform_settings')
  .select('*');
```

Note: RLS policies ensure only authenticated users can read settings.
