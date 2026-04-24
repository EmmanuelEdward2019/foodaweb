-- Add notifications table and payment_reference column
-- Run this in Supabase SQL Editor

-- 1. Notifications table (replaces the abuse of wallet_transactions for logging)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN (
    'order_created', 'order_status_update', 'payment_received',
    'delivery_assigned', 'custom', 'system'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_vendor_id ON notifications(vendor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_order_id ON notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users see their own notifications
CREATE POLICY "allow_own_notifications" ON notifications
  FOR ALL USING (user_id = auth.uid());

-- Vendors see notifications addressed to their vendor profile
CREATE POLICY "allow_vendor_notifications" ON notifications
  FOR ALL USING (
    vendor_id IN (SELECT id FROM vendors WHERE owner_id = auth.uid())
  );

-- Admins see all
CREATE POLICY "allow_admin_notifications" ON notifications
  FOR ALL USING (
    (auth.jwt()->'user_metadata'->>'role') = 'admin' OR
    (auth.jwt()->'app_metadata'->>'role')  = 'admin'
  );

-- 2. Add payment_reference column to orders (replaces storing it in notes)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_payment_reference ON orders(payment_reference);

-- 3. Mark old notification-pollution in wallet_transactions
--    (just for visibility — the data is left as-is, new writes will go to notifications)
COMMENT ON TABLE wallet_transactions IS
  'Financial transactions only. Notifications are in the notifications table.';

-- 4. Add wallet_balance view for easy balance lookup
CREATE OR REPLACE VIEW user_wallet_balance AS
SELECT
  user_id,
  COALESCE(SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE -amount END), 0) AS balance,
  COUNT(*) AS transaction_count,
  MAX(created_at) AS last_transaction_at
FROM wallet_transactions
GROUP BY user_id;

-- Verification
SELECT 'Notifications table' AS item, COUNT(*) FROM notifications
UNION ALL
SELECT 'Orders with payment_reference col', COUNT(*) FROM information_schema.columns
  WHERE table_name = 'orders' AND column_name = 'payment_reference';
