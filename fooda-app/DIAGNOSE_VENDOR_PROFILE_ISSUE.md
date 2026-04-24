# Diagnose and Fix "No Vendor Profile Found" Error

## 🔍 Problem
Vendor login shows: "No Vendor Profile Found - Please contact support to set up your vendor profile."

## 🎯 Root Cause
The vendor account exists in authentication but is missing either:
1. A record in the `users` table, OR
2. A record in the `vendors` table

## ✅ Solution: Run Diagnostic Script

### Step 1: Run Diagnostic
1. Go to: https://dukvrgupgtymxxbqpctq.supabase.co
2. Click **"SQL Editor"**
3. Click **"New Query"**
4. Copy **ENTIRE** contents of: `supabase/migrations/diagnose_and_fix_vendors.sql`
5. Click **"Run"**

### Step 2: Review Results
The script will show you 7 sections:

#### Section 1: Auth Users
Shows all vendor accounts in authentication

#### Section 2: Public Users
Shows all vendor records in `users` table

#### Section 3: Vendors
Shows all vendor profiles in `vendors` table

#### Section 4: Missing User Records ⚠️
**If this shows results**: Auth users exist but no user record

#### Section 5: Missing Vendor Profiles ⚠️
**If this shows results**: User records exist but no vendor profile

#### Section 6: Verification
Shows counts after fixes are applied

#### Section 7: Status Summary
Shows the status of each vendor account:
- ✅ All good
- ❌ Missing user record
- ❌ Missing vendor profile
- ⚠️ User deactivated
- ⚠️ Vendor deactivated

## 🔧 What the Script Does

### Diagnostic Phase
1. Checks auth.users for vendor accounts
2. Checks users table for vendor records
3. Checks vendors table for vendor profiles
4. Identifies missing records

### Fix Phase (Automatic)
1. **Creates missing user records** for any auth user without one
2. **Creates missing vendor profiles** for any user without one
3. **Verifies** all records are created

## 📊 Expected Output

### If Everything is OK:
```
Status Summary:
email@example.com | ✅ All good
```

### If Missing Records:
```
Before Fix:
email@example.com | ❌ Missing vendor profile

After Fix:
email@example.com | ✅ All good
```

## 🚀 After Running the Script

1. **Logout** from the application
2. **Clear browser cache** (Ctrl+Shift+Delete)
3. **Login** as vendor
4. **Should work!** ✅

## 🔍 Manual Check (If Still Not Working)

If the script doesn't fix it, check manually:

```sql
-- Replace 'YOUR_EMAIL' with the vendor's email
SELECT 
    au.email,
    au.id as auth_id,
    u.id as user_id,
    v.id as vendor_id
FROM auth.users au
LEFT JOIN users u ON u.id = au.id
LEFT JOIN vendors v ON v.owner_id = au.id
WHERE au.email = 'YOUR_EMAIL';
```

**Expected result:**
- `auth_id`: Should have a value
- `user_id`: Should have a value (same as auth_id)
- `vendor_id`: Should have a value

**If any are NULL:**
- NULL `user_id`: User record missing
- NULL `vendor_id`: Vendor profile missing

## 🛠️ Manual Fix (Last Resort)

If the automatic fix doesn't work, run these manually:

### Create User Record:
```sql
-- Replace with actual vendor email and ID
INSERT INTO users (id, email, role, full_name, is_active)
VALUES (
    'AUTH_USER_ID_HERE',
    'vendor@email.com',
    'vendor',
    'Business Name',
    true
);
```

### Create Vendor Profile:
```sql
-- Replace with actual user ID and details
INSERT INTO vendors (owner_id, name, email, is_active)
VALUES (
    'USER_ID_HERE',
    'Business Name',
    'vendor@email.com',
    true
);
```

## 📝 Common Issues

### Issue 1: "duplicate key value violates unique constraint"
**Cause**: Record already exists  
**Solution**: Check if vendor is deactivated instead of missing

### Issue 2: "foreign key constraint violation"
**Cause**: User record doesn't exist  
**Solution**: Create user record first, then vendor profile

### Issue 3: "permission denied"
**Cause**: RLS policies blocking  
**Solution**: Run as Supabase admin (in SQL Editor)

## ✅ Verification Steps

After running the fix:

1. **Check vendor count:**
```sql
SELECT COUNT(*) FROM vendors;
```

2. **Check specific vendor:**
```sql
SELECT * FROM vendors WHERE email = 'YOUR_VENDOR_EMAIL';
```

3. **Check RLS policies:**
```sql
SELECT * FROM pg_policies WHERE tablename = 'vendors';
```

## 🎯 Success Criteria

✅ Auth user exists  
✅ User record exists  
✅ Vendor profile exists  
✅ All IDs match  
✅ is_active = true  
✅ RLS policies allow SELECT  

## 📞 If Still Not Working

Check these:

1. **Browser console** for errors
2. **Network tab** for failed requests
3. **Supabase logs** for RLS policy errors
4. **Email verification** status
5. **User role** is set to 'vendor'

## ✨ Status: Ready to Run!

Run the diagnostic script and it will automatically fix missing records! 🚀
