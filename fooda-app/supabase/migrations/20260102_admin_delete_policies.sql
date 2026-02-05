-- Add DELETE policies for admins

-- Allow admins to delete vendors
DROP POLICY IF EXISTS "Admins can delete vendors" ON vendors;
CREATE POLICY "Admins can delete vendors" ON vendors
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Allow admins to delete users
DROP POLICY IF EXISTS "Admins can delete users" ON users;
CREATE POLICY "Admins can delete users" ON users
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Allow admins to delete menu items (for cascading delete)
DROP POLICY IF EXISTS "Admins can delete menu items" ON menu_items;
CREATE POLICY "Admins can delete menu items" ON menu_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Allow admins to delete menu categories (for cascading delete)
DROP POLICY IF EXISTS "Admins can delete menu categories" ON menu_categories;
CREATE POLICY "Admins can delete menu categories" ON menu_categories
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );
