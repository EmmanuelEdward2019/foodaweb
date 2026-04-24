-- Fix Infinite Recursion in RLS Policies
-- The problem: policies are checking the users table while querying the users table

-- ============================================
-- DROP ALL EXISTING POLICIES
-- ============================================

-- Users table
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;
DROP POLICY IF EXISTS "Admins can manage all users" ON users;

-- Vendors table
DROP POLICY IF EXISTS "Everyone can view active vendors" ON vendors;
DROP POLICY IF EXISTS "Vendors can view their own profile" ON vendors;
DROP POLICY IF EXISTS "Vendors can update their own profile" ON vendors;
DROP POLICY IF EXISTS "Vendors can insert their own profile" ON vendors;
DROP POLICY IF EXISTS "Admins can view all vendors" ON vendors;
DROP POLICY IF EXISTS "Admins can update all vendors" ON vendors;
DROP POLICY IF EXISTS "Admins can delete vendors" ON vendors;
DROP POLICY IF EXISTS "Admins can manage all vendors" ON vendors;

-- ============================================
-- CREATE SIMPLE, NON-RECURSIVE POLICIES
-- ============================================

-- USERS TABLE - Simple policies without recursion
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own data" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own data" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Allow service role to manage all users (for admin operations via service key)
CREATE POLICY "Service role can manage users" ON users
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- VENDORS TABLE - Simple policies without checking users table
CREATE POLICY "Public can view active vendors" ON vendors
  FOR SELECT USING (is_active = true);

CREATE POLICY "Vendors can view own profile" ON vendors
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Vendors can insert own profile" ON vendors
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Vendors can update own profile" ON vendors
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Vendors can delete own profile" ON vendors
  FOR DELETE USING (owner_id = auth.uid());

-- Service role can manage all vendors (for admin operations)
CREATE POLICY "Service role can manage vendors" ON vendors
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- MENU ITEMS - Simple policies
-- ============================================

DROP POLICY IF EXISTS "Everyone can view available menu items" ON menu_items;
DROP POLICY IF EXISTS "Vendors can view their menu items" ON menu_items;
DROP POLICY IF EXISTS "Vendors can insert menu items" ON menu_items;
DROP POLICY IF EXISTS "Vendors can update their menu items" ON menu_items;
DROP POLICY IF EXISTS "Vendors can delete their menu items" ON menu_items;
DROP POLICY IF EXISTS "Admins can manage all menu items" ON menu_items;

CREATE POLICY "Public can view available items" ON menu_items
  FOR SELECT USING (is_available = true);

CREATE POLICY "Vendors can manage their items" ON menu_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM vendors WHERE id = vendor_id AND owner_id = auth.uid())
  );

CREATE POLICY "Service role can manage items" ON menu_items
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- MENU CATEGORIES - Simple policies
-- ============================================

DROP POLICY IF EXISTS "Everyone can view active categories" ON menu_categories;
DROP POLICY IF EXISTS "Vendors can manage their categories" ON menu_categories;
DROP POLICY IF EXISTS "Admins can manage all categories" ON menu_categories;

CREATE POLICY "Public can view active categories" ON menu_categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "Vendors can manage their categories" ON menu_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM vendors WHERE id = vendor_id AND owner_id = auth.uid())
  );

CREATE POLICY "Service role can manage categories" ON menu_categories
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- MENU ITEM ADDONS - Simple policies
-- ============================================

DROP POLICY IF EXISTS "Everyone can view available addons" ON menu_item_addons;
DROP POLICY IF EXISTS "Vendors can manage their addons" ON menu_item_addons;
DROP POLICY IF EXISTS "Admins can manage all addons" ON menu_item_addons;

CREATE POLICY "Public can view available addons" ON menu_item_addons
  FOR SELECT USING (is_available = true);

CREATE POLICY "Vendors can manage their addons" ON menu_item_addons
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM menu_items mi
      JOIN vendors v ON v.id = mi.vendor_id
      WHERE mi.id = menu_item_id AND v.owner_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage addons" ON menu_item_addons
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 
    'Policy Check' as info,
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename IN ('users', 'vendors', 'menu_items', 'menu_categories', 'menu_item_addons')
ORDER BY tablename, cmd;
