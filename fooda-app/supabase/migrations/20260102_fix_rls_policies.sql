-- Fix RLS policies for users table to allow vendors to read their own data

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;

-- Create new policies that work properly
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Fix vendors table policies
DROP POLICY IF EXISTS "Everyone can view active vendors" ON vendors;
DROP POLICY IF EXISTS "Vendors can view their own profile" ON vendors;
DROP POLICY IF EXISTS "Vendors can update their own profile" ON vendors;

-- Create better policies for vendors
CREATE POLICY "Everyone can view active vendors" ON vendors
  FOR SELECT USING (is_active = true);

CREATE POLICY "Vendors can view their own vendor profile" ON vendors
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Vendors can update their own vendor profile" ON vendors
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Vendors can insert their own vendor profile" ON vendors
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Allow admins to view all vendors
CREATE POLICY "Admins can view all vendors" ON vendors
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Allow admins to update all vendors
CREATE POLICY "Admins can update all vendors" ON vendors
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Fix menu_categories policies to allow vendors to manage their categories
DROP POLICY IF EXISTS "Everyone can view vendor menu categories" ON menu_categories;

CREATE POLICY "Everyone can view active menu categories" ON menu_categories
  FOR SELECT USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM vendors WHERE id = vendor_id AND is_active = true
    )
  );

CREATE POLICY "Vendors can manage their menu categories" ON menu_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM vendors WHERE id = vendor_id AND owner_id = auth.uid()
    )
  );
