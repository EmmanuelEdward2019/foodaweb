-- Comprehensive RLS Policy Fix for All CRUD Operations
-- This migration ensures admins and vendors can perform all necessary operations

-- ============================================
-- USERS TABLE POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;

-- Recreate policies
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage all users" ON users
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- VENDORS TABLE POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Everyone can view active vendors" ON vendors;
DROP POLICY IF EXISTS "Vendors can view their own vendor profile" ON vendors;
DROP POLICY IF EXISTS "Vendors can update their own vendor profile" ON vendors;
DROP POLICY IF EXISTS "Vendors can insert their own vendor profile" ON vendors;
DROP POLICY IF EXISTS "Admins can view all vendors" ON vendors;
DROP POLICY IF EXISTS "Admins can update all vendors" ON vendors;
DROP POLICY IF EXISTS "Admins can delete vendors" ON vendors;
DROP POLICY IF EXISTS "Admins can manage all vendors" ON vendors;

-- Recreate policies
CREATE POLICY "Everyone can view active vendors" ON vendors
  FOR SELECT USING (is_active = true);

CREATE POLICY "Vendors can view their own profile" ON vendors
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Vendors can update their own profile" ON vendors
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Vendors can insert their own profile" ON vendors
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Admins can manage all vendors" ON vendors
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- MENU_ITEMS TABLE POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Everyone can view available menu items" ON menu_items;
DROP POLICY IF EXISTS "Vendors can manage their menu items" ON menu_items;
DROP POLICY IF EXISTS "Admins can manage all menu items" ON menu_items;

-- Recreate policies
CREATE POLICY "Everyone can view available menu items" ON menu_items
  FOR SELECT USING (
    is_available = true AND EXISTS (
      SELECT 1 FROM vendors WHERE id = vendor_id AND is_active = true
    )
  );

CREATE POLICY "Vendors can view their menu items" ON menu_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM vendors WHERE id = vendor_id AND owner_id = auth.uid())
  );

CREATE POLICY "Vendors can insert menu items" ON menu_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM vendors WHERE id = vendor_id AND owner_id = auth.uid())
  );

CREATE POLICY "Vendors can update their menu items" ON menu_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM vendors WHERE id = vendor_id AND owner_id = auth.uid())
  );

CREATE POLICY "Vendors can delete their menu items" ON menu_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM vendors WHERE id = vendor_id AND owner_id = auth.uid())
  );

CREATE POLICY "Admins can manage all menu items" ON menu_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- MENU_CATEGORIES TABLE POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Everyone can view active categories" ON menu_categories;
DROP POLICY IF EXISTS "Vendors can manage their categories" ON menu_categories;
DROP POLICY IF EXISTS "Admins can manage all categories" ON menu_categories;

-- Recreate policies
CREATE POLICY "Everyone can view active categories" ON menu_categories
  FOR SELECT USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM vendors WHERE id = vendor_id AND is_active = true
    )
  );

CREATE POLICY "Vendors can manage their categories" ON menu_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM vendors WHERE id = vendor_id AND owner_id = auth.uid())
  );

CREATE POLICY "Admins can manage all categories" ON menu_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- MENU_ITEM_ADDONS TABLE POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Everyone can view available addons" ON menu_item_addons;
DROP POLICY IF EXISTS "Vendors can manage their addons" ON menu_item_addons;
DROP POLICY IF EXISTS "Admins can manage all addons" ON menu_item_addons;

-- Recreate policies
CREATE POLICY "Everyone can view available addons" ON menu_item_addons
  FOR SELECT USING (
    is_available = true AND EXISTS (
      SELECT 1 FROM menu_items mi
      JOIN vendors v ON v.id = mi.vendor_id
      WHERE mi.id = menu_item_id AND v.is_active = true AND mi.is_available = true
    )
  );

CREATE POLICY "Vendors can manage their addons" ON menu_item_addons
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM menu_items mi
      JOIN vendors v ON v.id = mi.vendor_id
      WHERE mi.id = menu_item_id AND v.owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all addons" ON menu_item_addons
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- VERIFICATION
-- ============================================

-- Check all policies are created
SELECT schemaname, tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('users', 'vendors', 'menu_items', 'menu_categories', 'menu_item_addons')
ORDER BY tablename, cmd, policyname;
