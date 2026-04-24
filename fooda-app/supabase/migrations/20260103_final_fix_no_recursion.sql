-- FINAL FIX: Remove ALL policies and create simple, non-recursive ones
-- This uses auth metadata instead of querying the users table

-- ============================================
-- DROP ALL EXISTING POLICIES
-- ============================================

-- Users
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;
DROP POLICY IF EXISTS "Users can insert their own data" ON users;
DROP POLICY IF EXISTS "Service role can manage users" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can update users" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;

-- Vendors
DROP POLICY IF EXISTS "Public can view active vendors" ON vendors;
DROP POLICY IF EXISTS "Vendors can view own profile" ON vendors;
DROP POLICY IF EXISTS "Vendors can insert own profile" ON vendors;
DROP POLICY IF EXISTS "Vendors can update own profile" ON vendors;
DROP POLICY IF EXISTS "Vendors can delete own profile" ON vendors;
DROP POLICY IF EXISTS "Service role can manage vendors" ON vendors;
DROP POLICY IF EXISTS "Admins can view all vendors" ON vendors;
DROP POLICY IF EXISTS "Admins can insert vendors" ON vendors;
DROP POLICY IF EXISTS "Admins can update vendors" ON vendors;
DROP POLICY IF EXISTS "Admins can delete vendors" ON vendors;

-- Menu Items
DROP POLICY IF EXISTS "Public can view available items" ON menu_items;
DROP POLICY IF EXISTS "Vendors can manage their items" ON menu_items;
DROP POLICY IF EXISTS "Service role can manage items" ON menu_items;
DROP POLICY IF EXISTS "Admins can view all menu items" ON menu_items;
DROP POLICY IF EXISTS "Admins can manage menu items" ON menu_items;

-- Menu Categories
DROP POLICY IF EXISTS "Public can view active categories" ON menu_categories;
DROP POLICY IF EXISTS "Vendors can manage their categories" ON menu_categories;
DROP POLICY IF EXISTS "Service role can manage categories" ON menu_categories;
DROP POLICY IF EXISTS "Admins can view all categories" ON menu_categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON menu_categories;

-- Menu Item Addons
DROP POLICY IF EXISTS "Public can view available addons" ON menu_item_addons;
DROP POLICY IF EXISTS "Vendors can manage their addons" ON menu_item_addons;
DROP POLICY IF EXISTS "Service role can manage addons" ON menu_item_addons;
DROP POLICY IF EXISTS "Admins can view all addons" ON menu_item_addons;
DROP POLICY IF EXISTS "Admins can manage addons" ON menu_item_addons;

-- ============================================
-- DISABLE RLS TEMPORARILY TO FIX DATA
-- ============================================

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE vendors DISABLE ROW LEVEL SECURITY;

-- Create user records for all auth users
INSERT INTO users (id, email, role, full_name, is_active)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'role', 'user') as role,
    COALESCE(
        au.raw_user_meta_data->>'business_name',
        au.raw_user_meta_data->>'full_name',
        split_part(au.email, '@', 1)
    ) as full_name,
    true
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = au.id)
ON CONFLICT (id) DO UPDATE
SET role = COALESCE(EXCLUDED.role, users.role);

-- Create vendor profiles for all vendor users
INSERT INTO vendors (owner_id, name, email, is_active)
SELECT 
    u.id,
    u.full_name,
    u.email,
    true
FROM users u
WHERE u.role = 'vendor'
AND NOT EXISTS (SELECT 1 FROM vendors v WHERE v.owner_id = u.id)
ON CONFLICT DO NOTHING;

-- Re-enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CREATE SIMPLE POLICIES (NO RECURSION)
-- ============================================

-- USERS TABLE
CREATE POLICY "allow_own_select" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "allow_own_update" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "allow_own_insert" ON users FOR INSERT WITH CHECK (auth.uid() = id);

-- VENDORS TABLE  
CREATE POLICY "allow_public_select" ON vendors FOR SELECT USING (is_active = true OR owner_id = auth.uid());
CREATE POLICY "allow_own_insert" ON vendors FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "allow_own_update" ON vendors FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "allow_own_delete" ON vendors FOR DELETE USING (owner_id = auth.uid());

-- MENU ITEMS
CREATE POLICY "allow_public_select_items" ON menu_items FOR SELECT USING (
    is_available = true OR 
    EXISTS (SELECT 1 FROM vendors WHERE id = vendor_id AND owner_id = auth.uid())
);
CREATE POLICY "allow_vendor_manage_items" ON menu_items FOR ALL USING (
    EXISTS (SELECT 1 FROM vendors WHERE id = vendor_id AND owner_id = auth.uid())
);

-- MENU CATEGORIES
CREATE POLICY "allow_public_select_categories" ON menu_categories FOR SELECT USING (
    is_active = true OR
    EXISTS (SELECT 1 FROM vendors WHERE id = vendor_id AND owner_id = auth.uid())
);
CREATE POLICY "allow_vendor_manage_categories" ON menu_categories FOR ALL USING (
    EXISTS (SELECT 1 FROM vendors WHERE id = vendor_id AND owner_id = auth.uid())
);

-- MENU ITEM ADDONS
CREATE POLICY "allow_public_select_addons" ON menu_item_addons FOR SELECT USING (
    is_available = true OR
    EXISTS (
        SELECT 1 FROM menu_items mi
        JOIN vendors v ON v.id = mi.vendor_id
        WHERE mi.id = menu_item_id AND v.owner_id = auth.uid()
    )
);
CREATE POLICY "allow_vendor_manage_addons" ON menu_item_addons FOR ALL USING (
    EXISTS (
        SELECT 1 FROM menu_items mi
        JOIN vendors v ON v.id = mi.vendor_id
        WHERE mi.id = menu_item_id AND v.owner_id = auth.uid()
    )
);

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'Users created' as info, COUNT(*) as count FROM users;
SELECT 'Vendors created' as info, COUNT(*) as count FROM vendors;
SELECT 'Policies created' as info, COUNT(*) as count FROM pg_policies 
WHERE tablename IN ('users', 'vendors', 'menu_items', 'menu_categories', 'menu_item_addons');
