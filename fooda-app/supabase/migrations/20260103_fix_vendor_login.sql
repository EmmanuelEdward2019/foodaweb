-- Fix Vendor Login Issue - Allow vendors to view their own profile
-- This migration fixes the "Vendor Profile not found" error

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Vendors can view their own profile" ON vendors;

-- Recreate with correct logic
CREATE POLICY "Vendors can view their own profile" ON vendors
  FOR SELECT USING (
    owner_id = auth.uid() OR 
    is_active = true OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Ensure vendors can still insert their profile during signup
DROP POLICY IF EXISTS "Vendors can insert their own profile" ON vendors;
CREATE POLICY "Vendors can insert their own profile" ON vendors
  FOR INSERT WITH CHECK (
    owner_id = auth.uid() OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Ensure vendors can update their profile
DROP POLICY IF EXISTS "Vendors can update their own profile" ON vendors;
CREATE POLICY "Vendors can update their own profile" ON vendors
  FOR UPDATE USING (
    owner_id = auth.uid() OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Verify the policies
SELECT schemaname, tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename = 'vendors'
ORDER BY cmd, policyname;
