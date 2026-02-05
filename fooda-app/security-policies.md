# Security Policies Implementation Guide

This document explains how to implement Row Level Security (RLS) policies in Supabase for the Fooda application.

## Prerequisites

1. Create a Supabase project at https://app.supabase.com/
2. Access the SQL editor in the Supabase dashboard
3. Execute the schema SQL script to create tables
4. Enable RLS on all tables (already included in schema)

## Authentication Roles

The application uses the following roles:
- `customer`: End users who place orders
- `vendor`: Restaurant owners who manage menus and fulfill orders
- `delivery_person`: Users who deliver orders
- `admin`: System administrators

## Policy Implementation

All policies are implemented using Postgres row-level security. The policies ensure that users can only access data they're authorized to see.

### Users Table Policies

```sql
-- Users can view their own profile
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (auth.uid() = id);
```

### Vendors Table Policies

```sql
-- Everyone can view active vendors
CREATE POLICY "Everyone can view active vendors" ON vendors
  FOR SELECT USING (is_active = true);

-- Vendors can view their own profile
CREATE POLICY "Vendors can view their own profile" ON vendors
  FOR SELECT USING (owner_id = auth.uid());

-- Vendors can update their own profile
CREATE POLICY "Vendors can update their own profile" ON vendors
  FOR UPDATE USING (owner_id = auth.uid());
```

### Menu Categories and Items Policies

```sql
-- Everyone can view vendor menu categories
CREATE POLICY "Everyone can view vendor menu categories" ON menu_categories
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM vendors WHERE id = vendor_id AND is_active = true
  ));

-- Everyone can view available menu items
CREATE POLICY "Everyone can view available menu items" ON menu_items
  FOR SELECT USING (is_available = true AND EXISTS (
    SELECT 1 FROM vendors WHERE id = vendor_id AND is_active = true
  ));

-- Vendors can manage their own menu items
CREATE POLICY "Vendors can manage their own menu items" ON menu_items
  FOR ALL USING (EXISTS (
    SELECT 1 FROM vendors WHERE id = vendor_id AND owner_id = auth.uid()
  ));
```

### User Addresses Policies

```sql
-- Users can view their own addresses
CREATE POLICY "Users can view their own addresses" ON user_addresses
  FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own addresses
CREATE POLICY "Users can insert their own addresses" ON user_addresses
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own addresses
CREATE POLICY "Users can update their own addresses" ON user_addresses
  FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own addresses
CREATE POLICY "Users can delete their own addresses" ON user_addresses
  FOR DELETE USING (user_id = auth.uid());
```

### Orders Policies

```sql
-- Customers can view their own orders
CREATE POLICY "Customers can view their own orders" ON orders
  FOR SELECT USING (customer_id = auth.uid());

-- Vendors can view their own orders
CREATE POLICY "Vendors can view their own orders" ON orders
  FOR SELECT USING (vendor_id IN (
    SELECT id FROM vendors WHERE owner_id = auth.uid()
  ));

-- Delivery persons can view assigned orders
CREATE POLICY "Delivery persons can view assigned orders" ON orders
  FOR SELECT USING (delivery_person_id = auth.uid());

-- Customers can insert their own orders
CREATE POLICY "Customers can insert their own orders" ON orders
  FOR INSERT WITH CHECK (customer_id = auth.uid());
```

### Order Items Policies

```sql
-- Users can view order items for their orders
CREATE POLICY "Users can view order items for their orders" ON order_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM orders WHERE id = order_id AND (
      customer_id = auth.uid() OR 
      vendor_id IN (SELECT id FROM vendors WHERE owner_id = auth.uid()) OR
      delivery_person_id = auth.uid()
    )
  ));
```

### Delivery Persons Policies

```sql
-- Delivery persons can view their own profile
CREATE POLICY "Delivery persons can view their own profile" ON delivery_persons
  FOR SELECT USING (user_id = auth.uid());

-- Delivery persons can update their own profile
CREATE POLICY "Delivery persons can update their own profile" ON delivery_persons
  FOR UPDATE USING (user_id = auth.uid());
```

### Reviews Policies

```sql
-- Everyone can view verified reviews
CREATE POLICY "Everyone can view verified reviews" ON reviews
  FOR SELECT USING (is_verified = true);

-- Customers can insert reviews for their orders
CREATE POLICY "Customers can insert reviews for their orders" ON reviews
  FOR INSERT WITH CHECK (customer_id = auth.uid() AND EXISTS (
    SELECT 1 FROM orders WHERE id = order_id AND customer_id = auth.uid()
  ));
```

### Wallet Transactions Policies

```sql
-- Users can view their own transactions
CREATE POLICY "Users can view their own transactions" ON wallet_transactions
  FOR SELECT USING (user_id = auth.uid());
```

## Enabling RLS on Tables

RLS is enabled on all tables with the following command:

```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
```

## Testing Policies

To test policies during development:

1. Create test users with different roles
2. Use `auth.uid()` to simulate authenticated users
3. Verify that each role can only access appropriate data

Example test:
```sql
-- Simulate a customer user
SET LOCAL "request.jwt.claim.sub" TO 'customer-user-id';
-- Now run SELECT queries to verify policies work
SELECT * FROM orders WHERE customer_id = 'customer-user-id';
```

## Additional Security Considerations

1. **API Keys**: Use service role keys only for server-side operations
2. **Anonymous Access**: Restrict anonymous access to only necessary operations
3. **Rate Limiting**: Implement rate limiting for API endpoints
4. **Data Validation**: Always validate data at the application level in addition to database constraints
5. **Encryption**: Consider encrypting sensitive data like phone numbers if required by privacy regulations