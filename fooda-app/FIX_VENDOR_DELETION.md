# Fix Vendor Deletion Issue

## 🔴 Problem
Vendor deletion shows "successful" but the vendor still appears in the dashboard.

## 🔍 Root Cause
RLS (Row Level Security) policies are blocking the DELETE operations. The delete queries are silently failing because admins don't have DELETE permissions.

## ✅ Solution

### Step 1: Run the DELETE Policies Migration

**Go to your Supabase Dashboard:**
1. Open: https://dukvrgupgtymxxbqpctq.supabase.co
2. Click **"SQL Editor"**
3. Click **"New Query"**
4. Copy and paste from: `supabase/migrations/20260102_admin_delete_policies.sql`
5. Click **"Run"** or press `Ctrl+Enter`

### Step 2: Verify the Policies

After running the migration, verify the policies exist:

```sql
-- Check vendors DELETE policy
SELECT * FROM pg_policies WHERE tablename = 'vendors' AND cmd = 'DELETE';

-- Check users DELETE policy
SELECT * FROM pg_policies WHERE tablename = 'users' AND cmd = 'DELETE';

-- Check menu_items DELETE policy
SELECT * FROM pg_policies WHERE tablename = 'menu_items' AND cmd = 'DELETE';

-- Check menu_categories DELETE policy
SELECT * FROM pg_policies WHERE tablename = 'menu_categories' AND cmd = 'DELETE';
```

You should see policies named:
- "Admins can delete vendors"
- "Admins can delete users"
- "Admins can delete menu items"
- "Admins can delete menu categories"

### Step 3: Test Deletion

1. **Logout** from admin dashboard
2. **Clear browser cache** (Ctrl+Shift+Delete)
3. **Login again** as admin
4. **Try deleting a vendor**
5. **Check the console** for detailed logs

## 🔧 What the Migration Does

The migration adds DELETE policies for admins:

```sql
-- Vendors
CREATE POLICY "Admins can delete vendors" ON vendors
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Users
CREATE POLICY "Admins can delete users" ON users
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Menu Items (for cascading delete)
CREATE POLICY "Admins can delete menu items" ON menu_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Menu Categories (for cascading delete)
CREATE POLICY "Admins can delete menu categories" ON menu_categories
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );
```

## 📊 Enhanced Logging

The delete function now logs each step:

```
Starting vendor deletion: {vendorId, ownerId, vendorName}
Menu items deleted
Categories deleted
Vendor deleted, count: 1
User deleted, count: 1
```

If any step fails, you'll see:
```
Error deleting menu items: {error details}
```

## 🔍 Debugging

### Check Console Logs

After clicking delete, check the browser console for:

1. **Success logs**:
   ```
   Starting vendor deletion: {...}
   Menu items deleted
   Categories deleted
   Vendor deleted, count: 1
   User deleted, count: 1
   ```

2. **Error logs**:
   ```
   Error deleting vendor: {error message}
   ```

### Common Errors

#### Error: "new row violates row-level security policy"
**Solution**: Run the DELETE policies migration

#### Error: "update or delete on table violates foreign key constraint"
**Solution**: The code already handles this by deleting in the correct order:
1. Menu items
2. Menu categories
3. Vendor
4. User

#### Vendor still appears after deletion
**Solution**: 
- Check console for errors
- Verify DELETE policies are in place
- Try hard refresh (Ctrl+Shift+R)

## 🧪 Manual Test

To manually test if deletion works:

```sql
-- As admin, try to delete a test vendor
DELETE FROM menu_items WHERE vendor_id = 'VENDOR_ID_HERE';
DELETE FROM menu_categories WHERE vendor_id = 'VENDOR_ID_HERE';
DELETE FROM vendors WHERE id = 'VENDOR_ID_HERE';
DELETE FROM users WHERE id = 'USER_ID_HERE';
```

If this works, the policies are correct.
If this fails, check your admin user's role:

```sql
SELECT id, email, role FROM users WHERE id = auth.uid();
```

Should return `role = 'admin'`.

## ✅ After Fix

Once the migration is applied:
1. ✅ Admins can delete vendors
2. ✅ All related data is deleted (cascading)
3. ✅ Vendor disappears from dashboard immediately
4. ✅ Detailed error messages if something fails
5. ✅ Console logs show exactly what happened

## 🚨 Important Notes

### What Gets Deleted
- ✅ All menu items for the vendor
- ✅ All menu categories for the vendor
- ✅ Vendor profile
- ✅ User account
- ❌ Orders (preserved for records)

### Cannot Be Undone
Once deleted, the vendor and all associated data are **permanently removed**. There is no undo.

### Alternative: Deactivate Instead
If you want to temporarily disable a vendor without losing data:
- Use the **"Deactivate"** button instead
- Vendor can be reactivated later
- All data is preserved

## 📝 Verification Checklist

After running the migration:
- [ ] Run the SQL migration in Supabase
- [ ] Verify DELETE policies exist
- [ ] Logout and login again
- [ ] Try deleting a test vendor
- [ ] Check console logs
- [ ] Verify vendor is removed from list
- [ ] Verify all related data is deleted

## ✨ Status

The code changes are already live. Just run the SQL migration and deletion will work! 🚀
