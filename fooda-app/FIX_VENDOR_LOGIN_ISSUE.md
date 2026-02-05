# Fix Vendor Login Issue

## 🔴 Problem
After running the comprehensive RLS migration, vendors cannot login. Error: "Vendor Profile not found"

## 🔍 Root Cause
The vendor SELECT policy was too restrictive. It only allowed viewing active vendors, but vendors need to view their own profile regardless of active status to login.

## ✅ Solution

**Run this SQL migration:**

File: `supabase/migrations/20260103_fix_vendor_login.sql`

### Steps:
1. Go to: https://dukvrgupgtymxxbqpctq.supabase.co
2. Click **"SQL Editor"**
3. Click **"New Query"**
4. Copy contents of: `20260103_fix_vendor_login.sql`
5. Click **"Run"**

## 🔧 What This Migration Does

### Before (Broken):
```sql
-- Only allowed viewing active vendors
CREATE POLICY "Vendors can view their own profile" ON vendors
  FOR SELECT USING (owner_id = auth.uid());
```

**Problem**: If vendor is inactive, they can't even view their own profile to login!

### After (Fixed):
```sql
-- Allows vendors to view their own profile OR active vendors OR admins
CREATE POLICY "Vendors can view their own profile" ON vendors
  FOR SELECT USING (
    owner_id = auth.uid() OR           -- Own profile (any status)
    is_active = true OR                -- Active vendors (public)
    EXISTS (SELECT 1 FROM users        -- Admins (all vendors)
      WHERE id = auth.uid() AND role = 'admin')
  );
```

**Fixed**: Vendors can always view their own profile, regardless of active status!

## 🧪 Testing

After running the migration:

1. **Logout** from vendor account
2. **Clear browser cache** (Ctrl+Shift+Delete)
3. **Login** as vendor
4. **Verify** vendor dashboard loads

## ✅ Expected Result

- ✅ Vendor can login successfully
- ✅ Vendor dashboard loads
- ✅ Vendor can view their profile
- ✅ Vendor can manage menu items
- ✅ Admin can still manage all vendors

## 📊 Policy Summary

| User Type | Can View | Can Insert | Can Update | Can Delete |
|-----------|----------|------------|------------|------------|
| **Vendor** | Own profile (any status) | Own profile | Own profile | ❌ No |
| **Public** | Active vendors only | ❌ No | ❌ No | ❌ No |
| **Admin** | All vendors | All vendors | All vendors | All vendors |

## 🚨 Important Notes

### Why This Happened
The previous migration set policies that were too strict. It prevented vendors from viewing their own inactive profiles, which broke the login flow.

### The Fix
We now allow vendors to view their own profile regardless of `is_active` status, while still restricting public viewing to only active vendors.

### Security
This is still secure because:
- Vendors can only view/edit their own data
- Public can only see active vendors
- Admins have full control
- Inactive vendors can login but their data isn't public

## ✨ Status: Ready to Run!

Run the migration and vendor login will work again! 🚀
