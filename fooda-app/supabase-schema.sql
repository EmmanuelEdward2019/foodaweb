-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users table (for customers, vendors, and delivery persons)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT CHECK (role IN ('customer', 'vendor', 'delivery_person', 'admin')) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Vendor profiles (restaurants)
CREATE TABLE vendors (
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
CREATE TABLE menu_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Menu items
CREATE TABLE menu_items (
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
  prep_time INTEGER, -- in minutes
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Customer addresses
CREATE TABLE user_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT, -- e.g., "Home", "Work"
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

-- 6. Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  delivery_person_id UUID REFERENCES users(id) ON DELETE SET NULL,
  order_number TEXT UNIQUE NOT NULL,
  status TEXT CHECK (status IN (
    'pending', 
    'confirmed', 
    'preparing', 
    'ready_for_pickup', 
    'picked_up', 
    'delivered', 
    'cancelled'
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
  estimated_prep_time INTEGER, -- in minutes
  estimated_delivery_time TIMESTAMP WITH TIME ZONE,
  actual_delivery_time TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Order items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price_per_unit DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  special_instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Delivery persons
CREATE TABLE delivery_persons (
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

-- 9. Reviews
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  comment TEXT,
  is_verified BOOLEAN DEFAULT false, -- Verified if customer actually ordered from vendor
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(customer_id, vendor_id, order_id)
);

-- 10. Wallet transactions
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  transaction_type TEXT CHECK (transaction_type IN ('credit', 'debit')) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  balance_after DECIMAL(10, 2) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_vendors_owner_id ON vendors(owner_id);
CREATE INDEX idx_menu_items_vendor_id ON menu_items(vendor_id);
CREATE INDEX idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX idx_user_addresses_user_id ON user_addresses(user_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_vendor_id ON orders(vendor_id);
CREATE INDEX idx_orders_delivery_person_id ON orders(delivery_person_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_menu_item_id ON order_items(menu_item_id);
CREATE INDEX idx_delivery_persons_user_id ON delivery_persons(user_id);
CREATE INDEX idx_reviews_customer_id ON reviews(customer_id);
CREATE INDEX idx_reviews_vendor_id ON reviews(vendor_id);
CREATE INDEX idx_wallet_transactions_user_id ON wallet_transactions(user_id);

-- RLS (Row Level Security) Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Vendors policies
CREATE POLICY "Everyone can view active vendors" ON vendors
  FOR SELECT USING (is_active = true);

CREATE POLICY "Vendors can view their own profile" ON vendors
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Vendors can update their own profile" ON vendors
  FOR UPDATE USING (owner_id = auth.uid());

-- Menu categories policies
CREATE POLICY "Everyone can view vendor menu categories" ON menu_categories
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM vendors WHERE id = vendor_id AND is_active = true
  ));

-- Menu items policies
CREATE POLICY "Everyone can view available menu items" ON menu_items
  FOR SELECT USING (is_available = true AND EXISTS (
    SELECT 1 FROM vendors WHERE id = vendor_id AND is_active = true
  ));

CREATE POLICY "Vendors can manage their own menu items" ON menu_items
  FOR ALL USING (EXISTS (
    SELECT 1 FROM vendors WHERE id = vendor_id AND owner_id = auth.uid()
  ));

-- User addresses policies
CREATE POLICY "Users can view their own addresses" ON user_addresses
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own addresses" ON user_addresses
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own addresses" ON user_addresses
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own addresses" ON user_addresses
  FOR DELETE USING (user_id = auth.uid());

-- Orders policies
CREATE POLICY "Customers can view their own orders" ON orders
  FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Vendors can view their own orders" ON orders
  FOR SELECT USING (vendor_id IN (
    SELECT id FROM vendors WHERE owner_id = auth.uid()
  ));

CREATE POLICY "Delivery persons can view assigned orders" ON orders
  FOR SELECT USING (delivery_person_id = auth.uid());

CREATE POLICY "Customers can insert their own orders" ON orders
  FOR INSERT WITH CHECK (customer_id = auth.uid());

-- Order items policies
CREATE POLICY "Users can view order items for their orders" ON order_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM orders WHERE id = order_id AND (
      customer_id = auth.uid() OR 
      vendor_id IN (SELECT id FROM vendors WHERE owner_id = auth.uid()) OR
      delivery_person_id = auth.uid()
    )
  ));

-- Delivery persons policies
CREATE POLICY "Delivery persons can view their own profile" ON delivery_persons
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Delivery persons can update their own profile" ON delivery_persons
  FOR UPDATE USING (user_id = auth.uid());

-- Reviews policies
CREATE POLICY "Everyone can view verified reviews" ON reviews
  FOR SELECT USING (is_verified = true);

CREATE POLICY "Customers can insert reviews for their orders" ON reviews
  FOR INSERT WITH CHECK (customer_id = auth.uid() AND EXISTS (
    SELECT 1 FROM orders WHERE id = order_id AND customer_id = auth.uid()
  ));

-- Wallet transactions policies
CREATE POLICY "Users can view their own transactions" ON wallet_transactions
  FOR SELECT USING (user_id = auth.uid());