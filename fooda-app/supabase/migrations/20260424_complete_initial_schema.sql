-- =============================================================
-- FOODA COMPLETE INITIAL SCHEMA
-- Run this in the Supabase SQL Editor to set up the new database
-- Project: jxkmsdwqaxcqrqtmwlln.supabase.co
-- =============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
-- TABLES
-- =============================================================

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT CHECK (role IN ('customer', 'vendor', 'delivery_person', 'admin')) NOT NULL DEFAULT 'customer',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Vendor profiles (restaurants)
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  address JSONB,
  phone TEXT,
  email TEXT,
  business_hours JSONB,
  logo_url TEXT,
  cover_image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Menu categories
CREATE TABLE IF NOT EXISTS menu_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Menu items
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  category_id UUID REFERENCES menu_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  is_vegetarian BOOLEAN DEFAULT false,
  is_vegan BOOLEAN DEFAULT false,
  prep_time INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Menu item addons
CREATE TABLE IF NOT EXISTS menu_item_addons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Customer addresses
CREATE TABLE IF NOT EXISTS user_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  delivery_person_id UUID REFERENCES users(id) ON DELETE SET NULL,
  order_number TEXT UNIQUE NOT NULL,
  status TEXT CHECK (status IN (
    'pending', 'confirmed', 'preparing', 'ready_for_pickup',
    'picked_up', 'delivered', 'cancelled'
  )) DEFAULT 'pending',
  subtotal DECIMAL(10, 2) NOT NULL,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  delivery_fee DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'paypal', 'wallet')),
  payment_status TEXT CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')) DEFAULT 'pending',
  delivery_address JSONB,
  delivery_latitude DECIMAL(10, 8),
  delivery_longitude DECIMAL(11, 8),
  estimated_prep_time INTEGER,
  estimated_delivery_time TIMESTAMP WITH TIME ZONE,
  actual_delivery_time TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Order items
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price_per_unit DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  special_instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Delivery persons
CREATE TABLE IF NOT EXISTS delivery_persons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  vehicle_type TEXT CHECK (vehicle_type IN ('bike', 'motorcycle', 'car', 'scooter')),
  license_plate TEXT,
  is_available BOOLEAN DEFAULT true,
  current_latitude DECIMAL(10, 8),
  current_longitude DECIMAL(11, 8),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  comment TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(customer_id, vendor_id, order_id)
);

-- 11. Wallet transactions
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  transaction_type TEXT CHECK (transaction_type IN ('credit', 'debit')) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  balance_after DECIMAL(10, 2) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Platform settings
CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  setting_type TEXT CHECK (setting_type IN ('string', 'number', 'boolean', 'json')) DEFAULT 'string',
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- =============================================================
-- INDEXES
-- =============================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_vendors_owner_id ON vendors(owner_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_vendor_id ON menu_items(vendor_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_addons_menu_item_id ON menu_item_addons(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON user_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_vendor_id ON orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_person_id ON orders(delivery_person_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_delivery_persons_user_id ON delivery_persons(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer_id ON reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_vendor_id ON reviews(vendor_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON platform_settings(setting_key);

-- =============================================================
-- TRIGGER FUNCTIONS (updated_at)
-- =============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_platform_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vendors_updated_at ON vendors;
CREATE TRIGGER update_vendors_updated_at
  BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_menu_items_updated_at ON menu_items;
CREATE TRIGGER update_menu_items_updated_at
  BEFORE UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_menu_item_addons_updated_at ON menu_item_addons;
CREATE TRIGGER update_menu_item_addons_updated_at
  BEFORE UPDATE ON menu_item_addons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_delivery_persons_updated_at ON delivery_persons;
CREATE TRIGGER update_delivery_persons_updated_at
  BEFORE UPDATE ON delivery_persons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_platform_settings_timestamp ON platform_settings;
CREATE TRIGGER update_platform_settings_timestamp
  BEFORE UPDATE ON platform_settings FOR EACH ROW EXECUTE FUNCTION update_platform_settings_timestamp();

-- =============================================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- =============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, role, full_name, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
    COALESCE(
      NEW.raw_user_meta_data->>'business_name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================
-- AUTO-CREATE VENDOR PROFILE WHEN USER ROLE IS VENDOR
-- =============================================================

CREATE OR REPLACE FUNCTION public.handle_vendor_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'vendor' AND NOT EXISTS (SELECT 1 FROM public.vendors WHERE owner_id = NEW.id) THEN
    INSERT INTO public.vendors (owner_id, name, email, is_active)
    VALUES (NEW.id, NEW.full_name, NEW.email, true)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_vendor_user_created ON users;
CREATE TRIGGER on_vendor_user_created
  AFTER INSERT OR UPDATE OF role ON users
  FOR EACH ROW EXECUTE FUNCTION handle_vendor_signup();

-- =============================================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- RLS POLICIES
-- =============================================================

-- ---- USERS ----
DROP POLICY IF EXISTS "allow_own_select" ON users;
DROP POLICY IF EXISTS "allow_own_update" ON users;
DROP POLICY IF EXISTS "allow_own_insert" ON users;
DROP POLICY IF EXISTS "allow_admin_all_users" ON users;

CREATE POLICY "allow_own_select" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "allow_own_update" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "allow_own_insert" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Admin full access (uses JWT metadata to avoid recursion)
CREATE POLICY "allow_admin_all_users" ON users
  FOR ALL USING (
    (auth.jwt()->'user_metadata'->>'role') = 'admin' OR
    (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

-- ---- VENDORS ----
DROP POLICY IF EXISTS "allow_public_select_vendors" ON vendors;
DROP POLICY IF EXISTS "allow_own_insert_vendors" ON vendors;
DROP POLICY IF EXISTS "allow_own_update_vendors" ON vendors;
DROP POLICY IF EXISTS "allow_own_delete_vendors" ON vendors;
DROP POLICY IF EXISTS "allow_admin_all_vendors" ON vendors;

CREATE POLICY "allow_public_select_vendors" ON vendors
  FOR SELECT USING (is_active = true OR owner_id = auth.uid());

CREATE POLICY "allow_own_insert_vendors" ON vendors
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "allow_own_update_vendors" ON vendors
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "allow_own_delete_vendors" ON vendors
  FOR DELETE USING (owner_id = auth.uid());

CREATE POLICY "allow_admin_all_vendors" ON vendors
  FOR ALL USING (
    (auth.jwt()->'user_metadata'->>'role') = 'admin' OR
    (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

-- ---- MENU CATEGORIES ----
DROP POLICY IF EXISTS "allow_public_select_categories" ON menu_categories;
DROP POLICY IF EXISTS "allow_vendor_manage_categories" ON menu_categories;
DROP POLICY IF EXISTS "allow_admin_all_categories" ON menu_categories;

CREATE POLICY "allow_public_select_categories" ON menu_categories
  FOR SELECT USING (
    is_active = true OR
    EXISTS (SELECT 1 FROM vendors WHERE id = vendor_id AND owner_id = auth.uid())
  );

CREATE POLICY "allow_vendor_manage_categories" ON menu_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM vendors WHERE id = vendor_id AND owner_id = auth.uid())
  );

CREATE POLICY "allow_admin_all_categories" ON menu_categories
  FOR ALL USING (
    (auth.jwt()->'user_metadata'->>'role') = 'admin' OR
    (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

-- ---- MENU ITEMS ----
DROP POLICY IF EXISTS "allow_public_select_items" ON menu_items;
DROP POLICY IF EXISTS "allow_vendor_manage_items" ON menu_items;
DROP POLICY IF EXISTS "allow_admin_all_items" ON menu_items;

CREATE POLICY "allow_public_select_items" ON menu_items
  FOR SELECT USING (
    is_available = true OR
    EXISTS (SELECT 1 FROM vendors WHERE id = vendor_id AND owner_id = auth.uid())
  );

CREATE POLICY "allow_vendor_manage_items" ON menu_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM vendors WHERE id = vendor_id AND owner_id = auth.uid())
  );

CREATE POLICY "allow_admin_all_items" ON menu_items
  FOR ALL USING (
    (auth.jwt()->'user_metadata'->>'role') = 'admin' OR
    (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

-- ---- MENU ITEM ADDONS ----
DROP POLICY IF EXISTS "allow_public_select_addons" ON menu_item_addons;
DROP POLICY IF EXISTS "allow_vendor_manage_addons" ON menu_item_addons;
DROP POLICY IF EXISTS "allow_admin_all_addons" ON menu_item_addons;

CREATE POLICY "allow_public_select_addons" ON menu_item_addons
  FOR SELECT USING (
    is_available = true OR
    EXISTS (
      SELECT 1 FROM menu_items mi
      JOIN vendors v ON v.id = mi.vendor_id
      WHERE mi.id = menu_item_id AND v.owner_id = auth.uid()
    )
  );

CREATE POLICY "allow_vendor_manage_addons" ON menu_item_addons
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM menu_items mi
      JOIN vendors v ON v.id = mi.vendor_id
      WHERE mi.id = menu_item_id AND v.owner_id = auth.uid()
    )
  );

CREATE POLICY "allow_admin_all_addons" ON menu_item_addons
  FOR ALL USING (
    (auth.jwt()->'user_metadata'->>'role') = 'admin' OR
    (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

-- ---- USER ADDRESSES ----
DROP POLICY IF EXISTS "allow_own_addresses" ON user_addresses;

CREATE POLICY "allow_own_addresses" ON user_addresses
  FOR ALL USING (user_id = auth.uid());

-- ---- ORDERS ----
DROP POLICY IF EXISTS "allow_customer_select_orders" ON orders;
DROP POLICY IF EXISTS "allow_customer_insert_orders" ON orders;
DROP POLICY IF EXISTS "allow_vendor_select_orders" ON orders;
DROP POLICY IF EXISTS "allow_vendor_update_orders" ON orders;
DROP POLICY IF EXISTS "allow_delivery_select_orders" ON orders;
DROP POLICY IF EXISTS "allow_delivery_update_orders" ON orders;
DROP POLICY IF EXISTS "allow_admin_all_orders" ON orders;

CREATE POLICY "allow_customer_select_orders" ON orders
  FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "allow_customer_insert_orders" ON orders
  FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "allow_vendor_select_orders" ON orders
  FOR SELECT USING (
    vendor_id IN (SELECT id FROM vendors WHERE owner_id = auth.uid())
  );

CREATE POLICY "allow_vendor_update_orders" ON orders
  FOR UPDATE USING (
    vendor_id IN (SELECT id FROM vendors WHERE owner_id = auth.uid())
  );

CREATE POLICY "allow_delivery_select_orders" ON orders
  FOR SELECT USING (delivery_person_id = auth.uid());

CREATE POLICY "allow_delivery_update_orders" ON orders
  FOR UPDATE USING (delivery_person_id = auth.uid());

CREATE POLICY "allow_admin_all_orders" ON orders
  FOR ALL USING (
    (auth.jwt()->'user_metadata'->>'role') = 'admin' OR
    (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

-- ---- ORDER ITEMS ----
DROP POLICY IF EXISTS "allow_order_items_select" ON order_items;
DROP POLICY IF EXISTS "allow_order_items_insert" ON order_items;
DROP POLICY IF EXISTS "allow_admin_all_order_items" ON order_items;

CREATE POLICY "allow_order_items_select" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders WHERE id = order_id AND (
        customer_id = auth.uid() OR
        vendor_id IN (SELECT id FROM vendors WHERE owner_id = auth.uid()) OR
        delivery_person_id = auth.uid()
      )
    )
  );

CREATE POLICY "allow_order_items_insert" ON order_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM orders WHERE id = order_id AND customer_id = auth.uid())
  );

CREATE POLICY "allow_admin_all_order_items" ON order_items
  FOR ALL USING (
    (auth.jwt()->'user_metadata'->>'role') = 'admin' OR
    (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

-- ---- DELIVERY PERSONS ----
DROP POLICY IF EXISTS "allow_delivery_person_own" ON delivery_persons;
DROP POLICY IF EXISTS "allow_admin_all_delivery_persons" ON delivery_persons;

CREATE POLICY "allow_delivery_person_own" ON delivery_persons
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "allow_admin_all_delivery_persons" ON delivery_persons
  FOR ALL USING (
    (auth.jwt()->'user_metadata'->>'role') = 'admin' OR
    (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

-- ---- REVIEWS ----
DROP POLICY IF EXISTS "allow_public_select_reviews" ON reviews;
DROP POLICY IF EXISTS "allow_customer_insert_reviews" ON reviews;
DROP POLICY IF EXISTS "allow_admin_all_reviews" ON reviews;

CREATE POLICY "allow_public_select_reviews" ON reviews
  FOR SELECT USING (is_verified = true);

CREATE POLICY "allow_customer_insert_reviews" ON reviews
  FOR INSERT WITH CHECK (
    customer_id = auth.uid() AND
    EXISTS (SELECT 1 FROM orders WHERE id = order_id AND customer_id = auth.uid())
  );

CREATE POLICY "allow_admin_all_reviews" ON reviews
  FOR ALL USING (
    (auth.jwt()->'user_metadata'->>'role') = 'admin' OR
    (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

-- ---- WALLET TRANSACTIONS ----
DROP POLICY IF EXISTS "allow_own_wallet_transactions" ON wallet_transactions;
DROP POLICY IF EXISTS "allow_admin_all_wallet_transactions" ON wallet_transactions;

CREATE POLICY "allow_own_wallet_transactions" ON wallet_transactions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "allow_admin_all_wallet_transactions" ON wallet_transactions
  FOR ALL USING (
    (auth.jwt()->'user_metadata'->>'role') = 'admin' OR
    (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

-- ---- PLATFORM SETTINGS ----
DROP POLICY IF EXISTS "allow_admin_platform_settings" ON platform_settings;

CREATE POLICY "allow_admin_platform_settings" ON platform_settings
  FOR ALL USING (
    (auth.jwt()->'user_metadata'->>'role') = 'admin' OR
    (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

-- =============================================================
-- DEFAULT PLATFORM SETTINGS
-- =============================================================

INSERT INTO platform_settings (setting_key, setting_value, setting_type, description) VALUES
  ('delivery_fee',         '500',                  'number',  'Default delivery fee in Naira'),
  ('tax_rate',             '7.5',                  'number',  'Tax rate percentage'),
  ('commission_rate',      '15',                   'number',  'Platform commission rate percentage'),
  ('min_order_amount',     '1000',                 'number',  'Minimum order amount in Naira'),
  ('max_delivery_distance','10',                   'number',  'Maximum delivery distance in kilometers'),
  ('platform_name',        'Fooda',                'string',  'Platform name'),
  ('support_email',        'support@fooda.com',    'string',  'Support email address'),
  ('support_phone',        '+234-XXX-XXX-XXXX',    'string',  'Support phone number')
ON CONFLICT (setting_key) DO NOTHING;

-- =============================================================
-- VERIFICATION
-- =============================================================

SELECT 'Tables created' as info, COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'users','vendors','menu_categories','menu_items','menu_item_addons',
    'user_addresses','orders','order_items','delivery_persons',
    'reviews','wallet_transactions','platform_settings'
  );
