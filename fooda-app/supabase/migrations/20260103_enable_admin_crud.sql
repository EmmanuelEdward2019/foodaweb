-- Enable Admin CRUD Operations
-- Admins need to be able to manage users and vendors

-- First, ensure the admin user has the correct role in the users table
-- Replace 'admin@example.com' with your actual admin email
DO $$
DECLARE
    admin_email TEXT := 'emmanueledward2016@gmail.com'; -- Change this to your admin email
    admin_id UUID;
BEGIN
    -- Get admin user ID from auth
    SELECT id INTO admin_id FROM auth.users WHERE email = admin_email;
    
    IF admin_id IS NOT NULL THEN
        -- Insert or update admin user record
        INSERT INTO users (id, email, role, full_name, is_active)
        VALUES (admin_id, admin_email, 'admin', 'Admin User', true)
        ON CONFLICT (id) DO UPDATE
        SET role = 'admin', is_active = true;
        
        RAISE NOTICE 'Admin user created/updated: %', admin_email;
    ELSE
        RAISE NOTICE 'Admin user not found in auth.users: %', admin_email;
    END IF;
END $$;

-- ============================================
-- ADD ADMIN POLICIES
-- ============================================

-- USERS TABLE - Admin can manage all users
CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (
    -- User is viewing their own data OR user is an admin
    auth.uid() = id OR
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can insert users" ON users
  FOR INSERT WITH CHECK (
    auth.uid() = id OR
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can update users" ON users
  FOR UPDATE USING (
    auth.uid() = id OR
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can delete users" ON users
  FOR DELETE USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- VENDORS TABLE - Admin can manage all vendors
CREATE POLICY "Admins can view all vendors" ON vendors
  FOR SELECT USING (
    owner_id = auth.uid() OR
    is_active = true OR
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can insert vendors" ON vendors
  FOR INSERT WITH CHECK (
    owner_id = auth.uid() OR
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can update vendors" ON vendors
  FOR UPDATE USING (
    owner_id = auth.uid() OR
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can delete vendors" ON vendors
  FOR DELETE USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- MENU ITEMS - Admin can manage all
CREATE POLICY "Admins can view all menu items" ON menu_items
  FOR SELECT USING (
    is_available = true OR
    EXISTS (SELECT 1 FROM vendors WHERE id = vendor_id AND owner_id = auth.uid()) OR
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can manage menu items" ON menu_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM vendors WHERE id = vendor_id AND owner_id = auth.uid()) OR
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- MENU CATEGORIES - Admin can manage all
CREATE POLICY "Admins can view all categories" ON menu_categories
  FOR SELECT USING (
    is_active = true OR
    EXISTS (SELECT 1 FROM vendors WHERE id = vendor_id AND owner_id = auth.uid()) OR
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can manage categories" ON menu_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM vendors WHERE id = vendor_id AND owner_id = auth.uid()) OR
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- MENU ITEM ADDONS - Admin can manage all
CREATE POLICY "Admins can view all addons" ON menu_item_addons
  FOR SELECT USING (
    is_available = true OR
    EXISTS (
      SELECT 1 FROM menu_items mi
      JOIN vendors v ON v.id = mi.vendor_id
      WHERE mi.id = menu_item_id AND v.owner_id = auth.uid()
    ) OR
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can manage addons" ON menu_item_addons
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM menu_items mi
      JOIN vendors v ON v.id = mi.vendor_id
      WHERE mi.id = menu_item_id AND v.owner_id = auth.uid()
    ) OR
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- ============================================
-- VERIFICATION
-- ============================================

-- Check admin user
SELECT 
    'Admin User Check' as info,
    id,
    email,
    role,
    is_active
FROM users
WHERE role = 'admin';

-- Check policies
SELECT 
    'Policies' as info,
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename IN ('users', 'vendors', 'menu_items', 'menu_categories', 'menu_item_addons')
AND policyname LIKE '%Admin%'
ORDER BY tablename, cmd;
