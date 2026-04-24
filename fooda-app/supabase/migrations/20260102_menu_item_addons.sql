-- Add menu item addons table
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

-- Enable RLS
ALTER TABLE menu_item_addons ENABLE ROW LEVEL SECURITY;

-- Everyone can view available addons
CREATE POLICY "Everyone can view available addons" ON menu_item_addons
  FOR SELECT USING (
    is_available = true AND EXISTS (
      SELECT 1 FROM menu_items mi
      JOIN vendors v ON v.id = mi.vendor_id
      WHERE mi.id = menu_item_id AND v.is_active = true AND mi.is_available = true
    )
  );

-- Vendors can manage their menu item addons
CREATE POLICY "Vendors can manage their addons" ON menu_item_addons
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM menu_items mi
      JOIN vendors v ON v.id = mi.vendor_id
      WHERE mi.id = menu_item_id AND v.owner_id = auth.uid()
    )
  );

-- Admins can manage all addons
CREATE POLICY "Admins can manage all addons" ON menu_item_addons
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_menu_item_addons_menu_item_id ON menu_item_addons(menu_item_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_menu_item_addons_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_menu_item_addons_updated_at ON menu_item_addons;
CREATE TRIGGER update_menu_item_addons_updated_at
  BEFORE UPDATE ON menu_item_addons
  FOR EACH ROW
  EXECUTE FUNCTION update_menu_item_addons_timestamp();
