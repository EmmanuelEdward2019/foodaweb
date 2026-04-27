-- Fix infinite recursion in RLS policies.
-- Admin checks previously queried the users table from within a users-table policy,
-- causing Postgres to recurse. All admin checks now use jwt() or service_role instead.

-- ── Drop ALL existing policies on affected tables ─────────────────────

-- users
DROP POLICY IF EXISTS "Users can view their own profile"       ON users;
DROP POLICY IF EXISTS "Users can update their own profile"     ON users;
DROP POLICY IF EXISTS "Users can insert their own profile"     ON users;
DROP POLICY IF EXISTS "Users can view their own data"          ON users;
DROP POLICY IF EXISTS "Users can update their own data"        ON users;
DROP POLICY IF EXISTS "Users can insert their own data"        ON users;
DROP POLICY IF EXISTS "Admins can view all users"              ON users;
DROP POLICY IF EXISTS "Admins can update all users"            ON users;
DROP POLICY IF EXISTS "Admins can delete users"                ON users;
DROP POLICY IF EXISTS "Admins can manage all users"            ON users;
DROP POLICY IF EXISTS "Service role can manage users"          ON users;
DROP POLICY IF EXISTS "allow_own_select"                       ON users;
DROP POLICY IF EXISTS "allow_own_update"                       ON users;
DROP POLICY IF EXISTS "allow_own_insert"                       ON users;
DROP POLICY IF EXISTS "allow_admin_all_users"                  ON users;

-- vendors
DROP POLICY IF EXISTS "Everyone can view active vendors"            ON vendors;
DROP POLICY IF EXISTS "Public can view active vendors"              ON vendors;
DROP POLICY IF EXISTS "Vendors can view their own profile"          ON vendors;
DROP POLICY IF EXISTS "Vendors can view their own vendor profile"   ON vendors;
DROP POLICY IF EXISTS "Vendors can view own profile"                ON vendors;
DROP POLICY IF EXISTS "Vendors can update their own profile"        ON vendors;
DROP POLICY IF EXISTS "Vendors can update their own vendor profile" ON vendors;
DROP POLICY IF EXISTS "Vendors can update own profile"              ON vendors;
DROP POLICY IF EXISTS "Vendors can insert their own profile"        ON vendors;
DROP POLICY IF EXISTS "Vendors can insert their own vendor profile" ON vendors;
DROP POLICY IF EXISTS "Vendors can insert own profile"              ON vendors;
DROP POLICY IF EXISTS "Vendors can delete own profile"              ON vendors;
DROP POLICY IF EXISTS "Admins can view all vendors"                 ON vendors;
DROP POLICY IF EXISTS "Admins can update all vendors"               ON vendors;
DROP POLICY IF EXISTS "Admins can delete vendors"                   ON vendors;
DROP POLICY IF EXISTS "Admins can manage all vendors"               ON vendors;
DROP POLICY IF EXISTS "Service role can manage vendors"             ON vendors;
DROP POLICY IF EXISTS "allow_public_select_vendors"                 ON vendors;
DROP POLICY IF EXISTS "allow_own_insert_vendors"                    ON vendors;
DROP POLICY IF EXISTS "allow_own_update_vendors"                    ON vendors;
DROP POLICY IF EXISTS "allow_own_delete_vendors"                    ON vendors;
DROP POLICY IF EXISTS "allow_admin_all_vendors"                     ON vendors;

-- menu_items
DROP POLICY IF EXISTS "Everyone can view available menu items"  ON menu_items;
DROP POLICY IF EXISTS "Public can view available items"         ON menu_items;
DROP POLICY IF EXISTS "Vendors can view their menu items"       ON menu_items;
DROP POLICY IF EXISTS "Vendors can insert menu items"           ON menu_items;
DROP POLICY IF EXISTS "Vendors can update their menu items"     ON menu_items;
DROP POLICY IF EXISTS "Vendors can delete their menu items"     ON menu_items;
DROP POLICY IF EXISTS "Vendors can manage their own menu items" ON menu_items;
DROP POLICY IF EXISTS "Vendors can manage their items"          ON menu_items;
DROP POLICY IF EXISTS "Admins can manage all menu items"        ON menu_items;
DROP POLICY IF EXISTS "Service role can manage items"           ON menu_items;
DROP POLICY IF EXISTS "allow_public_select_items"               ON menu_items;
DROP POLICY IF EXISTS "allow_vendor_manage_items"               ON menu_items;
DROP POLICY IF EXISTS "allow_admin_all_items"                   ON menu_items;

-- menu_categories
DROP POLICY IF EXISTS "Everyone can view vendor menu categories"   ON menu_categories;
DROP POLICY IF EXISTS "Everyone can view active menu categories"   ON menu_categories;
DROP POLICY IF EXISTS "Everyone can view active categories"        ON menu_categories;
DROP POLICY IF EXISTS "Public can view active categories"          ON menu_categories;
DROP POLICY IF EXISTS "Vendors can manage their menu categories"   ON menu_categories;
DROP POLICY IF EXISTS "Vendors can manage their categories"        ON menu_categories;
DROP POLICY IF EXISTS "Admins can manage all categories"           ON menu_categories;
DROP POLICY IF EXISTS "Service role can manage categories"         ON menu_categories;
DROP POLICY IF EXISTS "allow_public_select_categories"             ON menu_categories;
DROP POLICY IF EXISTS "allow_vendor_manage_categories"             ON menu_categories;
DROP POLICY IF EXISTS "allow_admin_all_categories"                 ON menu_categories;

-- menu_item_addons
DROP POLICY IF EXISTS "Everyone can view available addons"  ON menu_item_addons;
DROP POLICY IF EXISTS "Public can view available addons"    ON menu_item_addons;
DROP POLICY IF EXISTS "Vendors can manage their addons"     ON menu_item_addons;
DROP POLICY IF EXISTS "Admins can manage all addons"        ON menu_item_addons;
DROP POLICY IF EXISTS "Service role can manage addons"      ON menu_item_addons;
DROP POLICY IF EXISTS "allow_public_select_addons"          ON menu_item_addons;
DROP POLICY IF EXISTS "allow_vendor_manage_addons"          ON menu_item_addons;
DROP POLICY IF EXISTS "allow_admin_all_addons"              ON menu_item_addons;

-- ── Recreate: users (no recursion — uses auth.uid() only) ─────────────
CREATE POLICY "allow_own_select" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "allow_own_update" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "allow_own_insert" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "allow_admin_all_users" ON users
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ── Recreate: vendors ─────────────────────────────────────────────────
CREATE POLICY "allow_public_select_vendors" ON vendors
  FOR SELECT USING (is_active = true);

CREATE POLICY "allow_own_insert_vendors" ON vendors
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "allow_own_update_vendors" ON vendors
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "allow_own_delete_vendors" ON vendors
  FOR DELETE USING (owner_id = auth.uid());

CREATE POLICY "allow_admin_all_vendors" ON vendors
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ── Recreate: menu_items ──────────────────────────────────────────────
CREATE POLICY "allow_public_select_items" ON menu_items
  FOR SELECT USING (is_available = true);

CREATE POLICY "allow_vendor_manage_items" ON menu_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM vendors WHERE id = vendor_id AND owner_id = auth.uid())
  );

CREATE POLICY "allow_admin_all_items" ON menu_items
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ── Recreate: menu_categories ─────────────────────────────────────────
CREATE POLICY "allow_public_select_categories" ON menu_categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "allow_vendor_manage_categories" ON menu_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM vendors WHERE id = vendor_id AND owner_id = auth.uid())
  );

CREATE POLICY "allow_admin_all_categories" ON menu_categories
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ── Recreate: menu_item_addons ────────────────────────────────────────
CREATE POLICY "allow_public_select_addons" ON menu_item_addons
  FOR SELECT USING (is_available = true);

CREATE POLICY "allow_vendor_manage_addons" ON menu_item_addons
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM menu_items mi
      JOIN vendors v ON v.id = mi.vendor_id
      WHERE mi.id = menu_item_id AND v.owner_id = auth.uid()
    )
  );

CREATE POLICY "allow_admin_all_addons" ON menu_item_addons
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ── Verification ──────────────────────────────────────────────────────
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('users', 'vendors', 'menu_items', 'menu_categories', 'menu_item_addons')
ORDER BY tablename, cmd;
