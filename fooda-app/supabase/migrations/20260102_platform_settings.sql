-- Create platform_settings table and seed defaults

CREATE TABLE IF NOT EXISTS platform_settings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key   TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  setting_type  TEXT CHECK (setting_type IN ('string', 'number', 'boolean', 'json')) DEFAULT 'string',
  description   TEXT,
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by    UUID REFERENCES users(id)
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- ── Policies ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view settings"   ON platform_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON platform_settings;
DROP POLICY IF EXISTS "Admins can insert settings" ON platform_settings;

CREATE POLICY "Admins can view settings" ON platform_settings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update settings" ON platform_settings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can insert settings" ON platform_settings
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ── Defaults ─────────────────────────────────────────────────────────
INSERT INTO platform_settings (setting_key, setting_value, setting_type, description) VALUES
  ('delivery_fee',          '500',                 'number', 'Default delivery fee in Naira'),
  ('tax_rate',              '7.5',                 'number', 'Tax rate percentage'),
  ('commission_rate',       '15',                  'number', 'Platform commission rate percentage'),
  ('min_order_amount',      '1000',                'number', 'Minimum order amount in Naira'),
  ('max_delivery_distance', '10',                  'number', 'Maximum delivery distance in kilometers'),
  ('platform_name',         'Fooda',               'string', 'Platform name'),
  ('support_email',         'support@fooda.com',   'string', 'Support email address'),
  ('support_phone',         '+234-XXX-XXX-XXXX',   'string', 'Support phone number')
ON CONFLICT (setting_key) DO NOTHING;

-- ── Index ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON platform_settings(setting_key);

-- ── Trigger ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_platform_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_platform_settings_timestamp ON platform_settings;
CREATE TRIGGER update_platform_settings_timestamp
  BEFORE UPDATE ON platform_settings
  FOR EACH ROW EXECUTE FUNCTION update_platform_settings_timestamp();
