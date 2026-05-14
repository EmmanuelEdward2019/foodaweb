# Fooda — Mobile App API & Integration Documentation

**Version:** 1.0  
**Target:** React Native (iOS + Android)  
**Web App:** https://foodaweb.vercel.app/  
**Last updated:** 2026-04-27

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Supabase Configuration](#2-supabase-configuration)
3. [Authentication](#3-authentication)
4. [Database Schema](#4-database-schema)
5. [Row Level Security (RLS) Summary](#5-row-level-security-rls-summary)
6. [API Operations — All Tables](#6-api-operations--all-tables)
7. [Edge Functions (Server-Side Logic)](#7-edge-functions-server-side-logic)
8. [Realtime Subscriptions](#8-realtime-subscriptions)
9. [Storage Buckets & File Uploads](#9-storage-buckets--file-uploads)
10. [Cart Logic (Client-Side)](#10-cart-logic-client-side)
11. [Payment Flow (Paystack)](#11-payment-flow-paystack)
12. [App Routes & Screen Map](#12-app-routes--screen-map)
13. [Branding & Design System](#13-branding--design-system)
14. [Business Rules & Validation](#14-business-rules--validation)
15. [Error Handling Patterns](#15-error-handling-patterns)
16. [Platform Settings (Dynamic Config)](#16-platform-settings-dynamic-config)
17. [React Native Setup Checklist](#17-react-native-setup-checklist)

---

## 1. Project Overview

Fooda is a **production-grade multi-vendor food ordering and delivery platform** operating in Nigeria (currency: NGN ₦). It connects three user types on a single backend:

| Role | Description |
|------|-------------|
| `customer` | Browse restaurants, place orders, track delivery, write reviews |
| `vendor` | Manage a restaurant profile, menu, orders, and analytics |
| `admin` | Full platform oversight — user management, vendor approval, financial reporting |
| `delivery_person` | Accept and fulfil delivery assignments (schema-ready, app not yet built) |

The backend is entirely Supabase (PostgreSQL + Auth + Storage + Edge Functions + Realtime). There is no custom REST API server. The mobile app communicates directly with Supabase using the official JS/TS SDK.

---

## 2. Supabase Configuration

```
Project URL:   https://jxkmsdwqaxcqrqtmwlln.supabase.co
Anon Key:      eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4a21zZHdxYXhjcXJxdG13bGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMzQ3NzUsImV4cCI6MjA5MjYxMDc3NX0.ZEYWRGvmr-zkxjdsZbzrbI6V6AXiaM6rgfvDkfQNwc4
```

**Environment variables to add to your `.env`:**

```
SUPABASE_URL=https://jxkmsdwqaxcqrqtmwlln.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
PAYSTACK_PUBLIC_KEY=pk_test_86f13bab0a38498ee1de7be9352d5fd3e94f731c
```

**Supabase client initialization (React Native):**

```typescript
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,           // persist session on device
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,       // required for React Native
    },
  }
);
```

> **Important:** React Native requires `detectSessionInUrl: false` and AsyncStorage as the session storage backend. Install `@react-native-async-storage/async-storage`.

---

## 3. Authentication

Supabase Auth is used for all identity management. The `public.users` table mirrors `auth.users` and stores the role.

### 3.1 Sign Up — Customer

```typescript
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      role: 'customer',
      full_name: 'John Doe',
    },
  },
});
```

A database trigger (`handle_new_user`) automatically inserts a row into `public.users` with the role from metadata.

### 3.2 Sign Up — Vendor

```typescript
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      role: 'vendor',
      business_name: 'My Restaurant',
      full_name: 'My Restaurant',   // used as vendor name
    },
  },
});
```

A second trigger (`handle_vendor_signup`) automatically creates a row in `public.vendors` linked to the new user.

### 3.3 Sign In

```typescript
const { data, error } = await supabase.auth.signInWithPassword({ email, password });
// data.session.access_token is the JWT
// data.user.id is the user UUID
```

### 3.4 Sign Out

```typescript
await supabase.auth.signOut();
```

### 3.5 Get Current Session

```typescript
const { data: { session } } = await supabase.auth.getSession();
```

### 3.6 Listen to Auth State Changes

```typescript
const { data: { subscription } } = supabase.auth.onAuthStateChange(
  async (event, session) => {
    // event: 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED'
  }
);
// cleanup: subscription.unsubscribe();
```

### 3.7 Fetch User Role (Always from DB — DB is authoritative)

```typescript
const { data, error } = await supabase
  .from('users')
  .select('role')
  .eq('id', session.user.id)
  .single();

const role = data?.role ?? 'customer'; // 'customer' | 'vendor' | 'admin' | 'delivery_person'
```

> **Critical:** Do NOT trust `user.user_metadata.role` for authorization decisions. Always fetch the role from `public.users` after sign-in. An admin's role can be changed in the DB without a new JWT being issued.

### 3.8 Role-Based Routing Logic

```
role === 'admin'           → Admin dashboard
role === 'vendor'          → Vendor dashboard
role === 'customer' | null → Customer restaurant list
role === 'delivery_person' → Delivery app (future)
```

### 3.9 Email Verification

Supabase sends a confirmation email on sign-up. Until verified, `data.session` is `null` and the user must log in after verifying. Handle this in the UI with an appropriate message.

---

## 4. Database Schema

### 4.1 `users`

Mirrors `auth.users`. Created automatically via trigger on sign-up.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Matches `auth.users.id` |
| `email` | TEXT UNIQUE NOT NULL | |
| `phone` | TEXT | Optional |
| `full_name` | TEXT | |
| `avatar_url` | TEXT | Profile photo URL |
| `role` | TEXT | `'customer'` \| `'vendor'` \| `'delivery_person'` \| `'admin'`. Default: `'customer'` |
| `is_active` | BOOLEAN | Default `true` |
| `created_at` | TIMESTAMPTZ | Auto |
| `updated_at` | TIMESTAMPTZ | Auto via trigger |

### 4.2 `vendors`

One row per restaurant. Auto-created for vendor signups.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `owner_id` | UUID FK → users | The vendor's user account |
| `name` | TEXT NOT NULL | Restaurant display name |
| `description` | TEXT | About the restaurant |
| `address` | JSONB | `{ street, area, city, state, country, lat, lng }` |
| `phone` | TEXT | Customer-facing contact |
| `email` | TEXT | Contact email |
| `business_hours` | JSONB | See structure below |
| `logo_url` | TEXT | Logo image URL (Supabase Storage) |
| `cover_image_url` | TEXT | Hero/banner image URL |
| `is_active` | BOOLEAN | Default `true`. Inactive vendors are hidden from customers |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**`business_hours` JSONB structure:**
```json
{
  "monday":    { "open": "09:00", "close": "22:00", "is_open": true },
  "tuesday":   { "open": "09:00", "close": "22:00", "is_open": true },
  "wednesday": { "open": "09:00", "close": "22:00", "is_open": true },
  "thursday":  { "open": "09:00", "close": "22:00", "is_open": true },
  "friday":    { "open": "09:00", "close": "23:00", "is_open": true },
  "saturday":  { "open": "10:00", "close": "23:00", "is_open": true },
  "sunday":    { "open": "12:00", "close": "20:00", "is_open": false }
}
```

**`address` JSONB structure:**
```json
{
  "street": "12 Adeola Odeku Street",
  "area": "Victoria Island",
  "city": "Lagos",
  "state": "Lagos State",
  "country": "Nigeria"
}
```

### 4.3 `menu_categories`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `vendor_id` | UUID FK → vendors | |
| `name` | TEXT NOT NULL | e.g. "Starters", "Main Course", "Drinks" |
| `description` | TEXT | |
| `is_active` | BOOLEAN | Default `true` |
| `sort_order` | INTEGER | Lower = shown first. Default `0` |
| `created_at` | TIMESTAMPTZ | |

### 4.4 `menu_items`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `vendor_id` | UUID FK → vendors | |
| `category_id` | UUID FK → menu_categories | Nullable (item may be uncategorized) |
| `name` | TEXT NOT NULL | |
| `description` | TEXT | |
| `price` | DECIMAL(10,2) NOT NULL | In Naira (NGN) |
| `image_url` | TEXT | Product image URL |
| `is_available` | BOOLEAN | Default `true`. Toggle to hide from customers |
| `is_vegetarian` | BOOLEAN | Default `false` |
| `is_vegan` | BOOLEAN | Default `false` |
| `prep_time` | INTEGER | Estimated prep time in minutes |
| `sort_order` | INTEGER | Default `0` |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### 4.5 `menu_item_addons`

Optional add-ons for a menu item (e.g. "Extra Cheese +₦200").

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `menu_item_id` | UUID FK → menu_items ON DELETE CASCADE | |
| `name` | TEXT NOT NULL | e.g. "Extra Cheese", "Large Size" |
| `price` | DECIMAL(10,2) NOT NULL | Additional cost. `0` = free |
| `is_available` | BOOLEAN | Default `true` |
| `sort_order` | INTEGER | Default `0` |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### 4.6 `user_addresses`

Saved delivery addresses for customers.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK → users | |
| `title` | TEXT | Label: "Home", "Work", etc. Also stored as `label` in some queries |
| `address_line1` | TEXT NOT NULL | Street address (also queried as `street`) |
| `address_line2` | TEXT | Apartment, floor, etc. (also `area`) |
| `city` | TEXT NOT NULL | |
| `state` | TEXT NOT NULL | |
| `postal_code` | TEXT NOT NULL | |
| `country` | TEXT NOT NULL | |
| `latitude` | DECIMAL(10,8) | Optional GPS |
| `longitude` | DECIMAL(11,8) | Optional GPS |
| `is_default` | BOOLEAN | Default `false`. Only one should be `true` per user |
| `created_at` | TIMESTAMPTZ | |

### 4.7 `orders`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `customer_id` | UUID FK → users | |
| `vendor_id` | UUID FK → vendors | |
| `delivery_person_id` | UUID FK → users | Nullable until assigned |
| `order_number` | TEXT UNIQUE | Human-readable e.g. `ORD-20260427-001` |
| `status` | TEXT | See status flow below |
| `subtotal` | DECIMAL(10,2) | Sum of items |
| `tax_amount` | DECIMAL(10,2) | |
| `delivery_fee` | DECIMAL(10,2) | |
| `total_amount` | DECIMAL(10,2) | subtotal + tax + delivery_fee |
| `payment_method` | TEXT | `'cash'` \| `'card'` \| `'paypal'` \| `'wallet'` |
| `payment_status` | TEXT | `'pending'` \| `'completed'` \| `'failed'` \| `'refunded'` |
| `payment_reference` | TEXT | Paystack transaction reference |
| `delivery_address` | JSONB | `{ street, area, city }` snapshot at time of order |
| `delivery_latitude` | DECIMAL(10,8) | |
| `delivery_longitude` | DECIMAL(11,8) | |
| `estimated_prep_time` | INTEGER | Minutes |
| `estimated_delivery_time` | TIMESTAMPTZ | |
| `actual_delivery_time` | TIMESTAMPTZ | |
| `notes` | TEXT | Customer delivery instructions |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Order status flow:**
```
pending → confirmed → preparing → ready_for_pickup → picked_up → delivered
                                                                → cancelled (from any non-delivered status)
```

**Status colours (for badges):**
```
pending           → #f59e0b (amber)
confirmed         → #3b82f6 (blue)
preparing         → #8b5cf6 (purple)
ready_for_pickup  → #06b6d4 (cyan)
picked_up         → #ff6b35 (brand orange)
delivered         → #16a34a (green)
cancelled         → #dc2626 (red)
```

### 4.8 `order_items`

Line items inside an order. Created atomically with the order by the `create-order` edge function.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `order_id` | UUID FK → orders ON DELETE CASCADE | |
| `menu_item_id` | UUID FK → menu_items ON DELETE SET NULL | Nullable (item may be deleted later) |
| `quantity` | INTEGER NOT NULL | Min 1 |
| `price_per_unit` | DECIMAL(10,2) | Price at time of order (snapshot) |
| `total_price` | DECIMAL(10,2) | quantity × price_per_unit |
| `special_instructions` | TEXT | Per-item customer notes |
| `created_at` | TIMESTAMPTZ | |

### 4.9 `delivery_persons`

Extended profile for users with `role = 'delivery_person'`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK → users | |
| `vehicle_type` | TEXT | `'bike'` \| `'motorcycle'` \| `'car'` \| `'scooter'` |
| `license_plate` | TEXT | |
| `is_available` | BOOLEAN | Whether accepting orders |
| `current_latitude` | DECIMAL(10,8) | GPS updated by app |
| `current_longitude` | DECIMAL(11,8) | |
| `last_seen` | TIMESTAMPTZ | Last GPS ping |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### 4.10 `reviews`

One review per (customer, vendor, order) triplet — enforced by UNIQUE constraint.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `customer_id` | UUID FK → users | |
| `vendor_id` | UUID FK → vendors | |
| `order_id` | UUID FK → orders | Required — only customers with a delivered order can review |
| `rating` | INTEGER | 1–5 (enforced by CHECK constraint) |
| `comment` | TEXT | Optional |
| `is_verified` | BOOLEAN | Default `false`. Admin sets to `true`. Only verified reviews are publicly visible |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### 4.11 `notifications`

In-app notifications sent to users and vendors.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK → users | Customer or vendor user |
| `vendor_id` | UUID FK → vendors | If notification is vendor-scoped |
| `order_id` | UUID FK → orders ON DELETE SET NULL | Tappable link target |
| `type` | TEXT | See types below |
| `title` | TEXT NOT NULL | Short heading |
| `message` | TEXT NOT NULL | Full notification body |
| `is_read` | BOOLEAN | Default `false` |
| `created_at` | TIMESTAMPTZ | |

**Notification types:**
```
order_created        → New order placed (for vendor)
order_status_update  → Status changed (for customer)
payment_received     → Payment confirmed (for vendor/customer)
delivery_assigned    → Delivery person assigned
custom               → Admin broadcast
system               → System alert
```

**Type icons & colours (for mobile notification UI):**
```
order_created        → 🛍️  #3b82f6
order_status_update  → 📦  #8b5cf6
payment_received     → 💳  #16a34a
delivery_assigned    → 🛵  #f59e0b
custom               → 📢  #ff6b35
system               → ℹ️  #6b7280
```

### 4.12 `wallet_transactions`

Ledger for wallet credit/debit transactions.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK → users | |
| `order_id` | UUID FK → orders | |
| `transaction_type` | TEXT | `'credit'` \| `'debit'` |
| `amount` | DECIMAL(10,2) | Always positive |
| `balance_after` | DECIMAL(10,2) | Running balance after this transaction |
| `description` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

**Wallet balance view:**
```sql
SELECT * FROM user_wallet_balance WHERE user_id = '<user-id>';
-- Returns: user_id, balance, transaction_count, last_transaction_at
```

### 4.13 `platform_settings`

Dynamic configuration controlled by admins. Always fetch these before checkout.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `setting_key` | TEXT UNIQUE | |
| `setting_value` | TEXT | Always stored as text; cast based on `setting_type` |
| `setting_type` | TEXT | `'string'` \| `'number'` \| `'boolean'` \| `'json'` |
| `description` | TEXT | |
| `updated_at` | TIMESTAMPTZ | |
| `updated_by` | UUID FK → users | Admin who last changed it |

**Default settings:**

| Key | Value | Type | Description |
|-----|-------|------|-------------|
| `delivery_fee` | `500` | number | Default delivery fee in NGN |
| `tax_rate` | `7.5` | number | Tax rate percentage (7.5%) |
| `commission_rate` | `15` | number | Platform commission % |
| `min_order_amount` | `1000` | number | Minimum order in NGN |
| `max_delivery_distance` | `10` | number | km radius |
| `platform_name` | `Fooda` | string | |
| `support_email` | `support@fooda.com` | string | |
| `support_phone` | `+234-XXX-XXX-XXXX` | string | |

---

## 5. Row Level Security (RLS) Summary

All tables have RLS enabled. Here is the access matrix:

| Table | Customer reads | Customer writes | Vendor reads | Vendor writes | Admin |
|-------|---------------|-----------------|--------------|---------------|-------|
| `users` | Own row only | Own row only | Own row only | Own row only | All rows |
| `vendors` | Active vendors | — | Own vendor | Own vendor | All |
| `menu_categories` | Active categories | — | Own vendor's | Own vendor's | All |
| `menu_items` | Available items | — | Own vendor's | Own vendor's | All |
| `menu_item_addons` | Available addons | — | Own vendor's | Own vendor's | All |
| `user_addresses` | Own addresses | Own addresses | — | — | All |
| `orders` | Own orders | Insert own | Vendor's orders | Update status | All |
| `order_items` | Own order items | Insert for own orders | Vendor's order items | — | All |
| `reviews` | Verified only | Insert (verified order required) | — | — | All |
| `notifications` | Own user_id | Update is_read | Own vendor_id | — | All |
| `wallet_transactions` | Own only | — | — | — | All |
| `platform_settings` | — | — | — | — | All |
| `delivery_persons` | — | — | — | — | All; own row for delivery_person |

---

## 6. API Operations — All Tables

### 6.1 Restaurants (vendors)

**List all active restaurants:**
```typescript
const { data } = await supabase
  .from('vendors')
  .select('id, name, description, address, phone, logo_url, cover_image_url, business_hours')
  .eq('is_active', true)
  .order('name');
```

**Get single restaurant with categories and items:**
```typescript
const { data } = await supabase
  .from('vendors')
  .select(`
    id, name, description, address, phone, email,
    logo_url, cover_image_url, business_hours,
    categories:menu_categories(
      id, name, description, sort_order, is_active,
      items:menu_items(
        id, name, description, price, image_url,
        is_available, is_vegetarian, is_vegan, prep_time, sort_order
      )
    )
  `)
  .eq('id', vendorId)
  .single();
```

**Get restaurant reviews (public — verified only):**
```typescript
const { data } = await supabase
  .from('reviews')
  .select('id, rating, comment, created_at, customer:users(full_name, avatar_url)')
  .eq('vendor_id', vendorId)
  .eq('is_verified', true)
  .order('created_at', { ascending: false });
```

**Compute average rating:**
```typescript
const { data } = await supabase
  .from('reviews')
  .select('rating')
  .eq('vendor_id', vendorId)
  .eq('is_verified', true);
const avg = data?.length
  ? data.reduce((s, r) => s + r.rating, 0) / data.length
  : 0;
```

**Search restaurants by name/cuisine:**
```typescript
const { data } = await supabase
  .from('vendors')
  .select('id, name, description, logo_url, address')
  .eq('is_active', true)
  .ilike('name', `%${query}%`);
```

### 6.2 Menu Items & Addons

**Get addons for a menu item:**
```typescript
const { data } = await supabase
  .from('menu_item_addons')
  .select('id, name, price, is_available, sort_order')
  .eq('menu_item_id', menuItemId)
  .eq('is_available', true)
  .order('sort_order');
```

**Get all items for a vendor (vendor dashboard):**
```typescript
const { data } = await supabase
  .from('menu_items')
  .select(`
    id, name, description, price, image_url,
    is_available, is_vegetarian, is_vegan, prep_time, sort_order, created_at,
    category:menu_categories(id, name)
  `)
  .eq('vendor_id', vendorId)
  .order('sort_order');
```

**Create a menu item (vendor only):**
```typescript
const { data, error } = await supabase
  .from('menu_items')
  .insert({
    vendor_id: vendorId,
    category_id: categoryId ?? null,
    name: 'Jollof Rice',
    description: 'Smoky Nigerian jollof rice with chicken',
    price: 2500,
    image_url: 'https://....',
    is_available: true,
    is_vegetarian: false,
    is_vegan: false,
    prep_time: 20,
    sort_order: 0,
  })
  .select()
  .single();
```

**Update menu item availability (toggle):**
```typescript
await supabase
  .from('menu_items')
  .update({ is_available: !currentValue })
  .eq('id', itemId);
```

### 6.3 User Profile

**Fetch own profile:**
```typescript
const { data } = await supabase
  .from('users')
  .select('id, full_name, email, phone, avatar_url, role, is_active, created_at')
  .eq('id', userId)
  .single();
```

**Update profile:**
```typescript
await supabase
  .from('users')
  .update({ full_name: 'New Name', phone: '+234 800 000 0000' })
  .eq('id', userId);
```

### 6.4 User Addresses

**Fetch saved addresses:**
```typescript
const { data } = await supabase
  .from('user_addresses')
  .select('*')
  .eq('user_id', userId)
  .order('is_default', { ascending: false });
```

**Add address:**
```typescript
const { data, error } = await supabase
  .from('user_addresses')
  .insert({
    user_id: userId,
    title: 'Home',
    address_line1: '12 Adeola Odeku Street',
    address_line2: 'Victoria Island',
    city: 'Lagos',
    state: 'Lagos State',
    postal_code: '106104',
    country: 'Nigeria',
    is_default: true,
  })
  .select()
  .single();
```

**Set default address (reset all, then set one):**
```typescript
await supabase
  .from('user_addresses')
  .update({ is_default: false })
  .eq('user_id', userId);

await supabase
  .from('user_addresses')
  .update({ is_default: true })
  .eq('id', addressId);
```

**Delete address:**
```typescript
await supabase.from('user_addresses').delete().eq('id', addressId);
```

### 6.5 Orders

**Fetch order history (customer):**
```typescript
const { data } = await supabase
  .from('orders')
  .select(`
    id, order_number, status, payment_status, total_amount, created_at, vendor_id,
    vendor:vendors(name, logo_url),
    items:order_items(id)
  `)
  .eq('customer_id', userId)
  .order('created_at', { ascending: false });
```

**Fetch single order with full details:**
```typescript
const { data } = await supabase
  .from('orders')
  .select(`
    id, order_number, status, payment_status,
    subtotal, tax_amount, delivery_fee, total_amount,
    delivery_address, notes, created_at, estimated_delivery_time,
    vendor:vendors(name, phone, address, logo_url),
    items:order_items(
      id, quantity, price_per_unit, total_price,
      menu_item:menu_items(name, image_url)
    )
  `)
  .eq('id', orderId)
  .single();
```

**Check if customer has a delivered order from a vendor (eligibility to review):**
```typescript
const { data } = await supabase
  .from('orders')
  .select('id')
  .eq('customer_id', userId)
  .eq('vendor_id', vendorId)
  .eq('status', 'delivered')
  .order('created_at', { ascending: false })
  .limit(1);
const eligibleOrderId = data?.[0]?.id ?? null;
```

**Check payment status by Paystack reference (for callback polling):**
```typescript
const { data } = await supabase
  .from('orders')
  .select('id, payment_status')
  .eq('payment_reference', paystackReference)
  .single();
```

### 6.6 Reviews

**Submit a review (customer with delivered order):**
```typescript
const { error } = await supabase
  .from('reviews')
  .insert({
    customer_id: userId,
    vendor_id: vendorId,
    order_id: orderId,
    rating: 5,           // 1–5
    comment: 'Amazing food, fast delivery!',
  });
// Duplicate: error.code === '23505' (unique_violation)
```

### 6.7 Notifications

**Fetch notifications:**
```typescript
const { data } = await supabase
  .from('notifications')
  .select('id, type, title, message, is_read, created_at, order_id')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(60);
```

**Mark one as read:**
```typescript
await supabase
  .from('notifications')
  .update({ is_read: true })
  .eq('id', notificationId);
```

**Mark all as read:**
```typescript
await supabase
  .from('notifications')
  .update({ is_read: true })
  .eq('user_id', userId)
  .eq('is_read', false);
```

**Unread count (for badge):**
```typescript
const { count } = await supabase
  .from('notifications')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', userId)
  .eq('is_read', false);
```

### 6.8 Platform Settings

**Fetch delivery fee and tax rate before checkout:**
```typescript
const { data } = await supabase
  .from('platform_settings')
  .select('setting_key, setting_value')
  .in('setting_key', ['delivery_fee', 'tax_rate', 'min_order_amount']);

// Parse:
const deliveryFee = parseFloat(data.find(s => s.setting_key === 'delivery_fee')?.setting_value ?? '500');
const taxRate     = parseFloat(data.find(s => s.setting_key === 'tax_rate')?.setting_value ?? '7.5') / 100;
```

### 6.9 Vendor Dashboard Queries

**Vendor's own profile:**
```typescript
const { data } = await supabase
  .from('vendors')
  .select('*')
  .eq('owner_id', userId)
  .single();
```

**Vendor orders with filter:**
```typescript
const query = supabase
  .from('orders')
  .select(`
    id, order_number, status, payment_status, total_amount, created_at, notes,
    customer:users(full_name, phone)
  `)
  .eq('vendor_id', vendorId)
  .order('created_at', { ascending: false });

// Optional filter:
if (statusFilter !== 'all') query.eq('status', statusFilter);
const { data } = await query;
```

**Update order status (vendor):**
```typescript
await supabase
  .from('orders')
  .update({ status: 'preparing' })   // next status in the flow
  .eq('id', orderId)
  .eq('vendor_id', vendorId);       // RLS double-check
```

**Top-selling items analytics:**
```typescript
const { data } = await supabase
  .from('order_items')
  .select('menu_item_id, quantity, menu_item:menu_items(name)')
  .in('order_id',
    // First get vendor's order IDs
    (await supabase.from('orders').select('id').eq('vendor_id', vendorId)).data?.map(o => o.id) ?? []
  );

// Aggregate client-side:
const totals: Record<string, { name: string; qty: number }> = {};
data?.forEach(item => {
  const id = item.menu_item_id!;
  totals[id] = totals[id]
    ? { ...totals[id], qty: totals[id].qty + item.quantity }
    : { name: (item.menu_item as any)?.name, qty: item.quantity };
});
const topItems = Object.entries(totals)
  .sort((a, b) => b[1].qty - a[1].qty)
  .slice(0, 5);
```

---

## 7. Edge Functions (Server-Side Logic)

These run on Supabase's Deno edge runtime. Call them with `supabase.functions.invoke()`.

### 7.1 `create-order`

Creates the order and its items atomically (single transaction). Also sends notifications.

**Request body:**
```typescript
{
  vendor_id: string;          // UUID
  items: Array<{
    menu_item_id: string;     // UUID
    quantity: number;         // min 1
  }>;
  delivery_address: {
    street: string;
    area?: string;
    city: string;
  };
  notes?: string;             // optional delivery instructions
}
```

**Response (success):**
```typescript
{
  order: {
    id: string;               // UUID — use this for payment
    order_number: string;     // e.g. "ORD-20260427-0042"
    total_amount: number;
    status: 'pending';
    payment_status: 'pending';
  }
}
```

**Response (error):**
```typescript
{ error: string }
```

**Example call:**
```typescript
const { data, error } = await supabase.functions.invoke('create-order', {
  body: {
    vendor_id: '550e8400-e29b-41d4-a716-446655440000',
    items: [
      { menu_item_id: 'abc123', quantity: 2 },
      { menu_item_id: 'def456', quantity: 1 },
    ],
    delivery_address: {
      street: '12 Adeola Odeku Street',
      area: 'Victoria Island',
      city: 'Lagos',
    },
    notes: 'Call on arrival, gate code 1234',
  },
});

const orderId = data?.order?.id;
```

### 7.2 `process-payment`

Initializes a Paystack payment transaction. Returns a payment URL to redirect the user to (or a mobile WebView URL for in-app payment).

**Request body:**
```typescript
{
  order_id: string;           // UUID from create-order
  amount: number;             // Total in NGN (e.g. 3500)
  email: string;              // Customer's email
  callback_url: string;       // Where Paystack redirects after payment
                              // Web: https://foodaweb.vercel.app/payment/callback
                              // Mobile: use deep link e.g. fooda://payment/callback
}
```

**Response (success):**
```typescript
{
  payment_url: string;        // Paystack authorization URL
  reference: string;          // Paystack transaction reference (save this)
}
```

**Response (error):**
```typescript
{ error: string }
```

**Mobile deep link setup:**
For React Native, configure a deep link scheme (e.g. `fooda://`) and use it as the callback URL. When the app receives `fooda://payment/callback?reference=xxx&trxref=xxx`, poll the `orders` table for `payment_status`.

**Example call:**
```typescript
const { data, error } = await supabase.functions.invoke('process-payment', {
  body: {
    order_id: orderId,
    amount: totalAmount,
    email: user.email,
    callback_url: 'fooda://payment/callback',
  },
});

if (data?.payment_url) {
  // Open in WebView or Linking.openURL()
  Linking.openURL(data.payment_url);
}
```

**Payment verification (polling after callback):**
```typescript
const verifyPayment = async (reference: string) => {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data } = await supabase
      .from('orders')
      .select('id, payment_status')
      .eq('payment_reference', reference)
      .single();

    if (data?.payment_status === 'completed') return { success: true, orderId: data.id };
    if (data?.payment_status === 'failed')    return { success: false };

    await new Promise(r => setTimeout(r, 2000)); // wait 2 seconds between attempts
  }
  return { success: false, pending: true }; // webhook may still be processing
};
```

---

## 8. Realtime Subscriptions

Supabase Realtime streams Postgres changes over WebSocket. Use for live order tracking.

### 8.1 Track Order Status Updates

```typescript
const channel = supabase
  .channel(`order-tracking-${orderId}`)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'orders',
      filter: `id=eq.${orderId}`,
    },
    (payload) => {
      const updatedOrder = payload.new;
      setOrderStatus(updatedOrder.status);
      setPaymentStatus(updatedOrder.payment_status);
    }
  )
  .subscribe();

// Cleanup:
return () => supabase.removeChannel(channel);
```

### 8.2 Vendor Live Order Feed

```typescript
const channel = supabase
  .channel(`vendor-orders-${vendorId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'orders',
      filter: `vendor_id=eq.${vendorId}`,
    },
    (payload) => {
      // New order arrived — refresh order list or add to top
      setOrders(prev => [payload.new, ...prev]);
    }
  )
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'orders',
      filter: `vendor_id=eq.${vendorId}`,
    },
    () => refetchOrders()
  )
  .subscribe();
```

### 8.3 Realtime Notifications

```typescript
const channel = supabase
  .channel(`notifications-${userId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`,
    },
    (payload) => {
      const notif = payload.new;
      // Show push notification or in-app badge update
      setBadgeCount(prev => prev + 1);
      showLocalNotification(notif.title, notif.message);
    }
  )
  .subscribe();
```

---

## 9. Storage Buckets & File Uploads

Two public storage buckets must exist in the Supabase dashboard:

| Bucket | Purpose | Access |
|--------|---------|--------|
| `menu-images` | Menu item photos | Public read |
| `vendor-images` | Restaurant logos and cover photos | Public read |

### 9.1 Upload Menu Item Image

```typescript
const uploadMenuImage = async (file: File | Blob, fileName: string): Promise<string> => {
  const path = `${vendorId}/${Date.now()}_${fileName}`;

  const { error } = await supabase.storage
    .from('menu-images')
    .upload(path, file, { upsert: true, contentType: 'image/jpeg' });

  if (error) throw error;

  const { data } = supabase.storage
    .from('menu-images')
    .getPublicUrl(path);

  return data.publicUrl;
};
```

### 9.2 Upload Vendor Logo or Cover Image

```typescript
const uploadVendorImage = async (
  file: File | Blob,
  type: 'logo' | 'cover'
): Promise<string> => {
  const path = `${vendorId}/${type}_${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from('vendor-images')
    .upload(path, file, { upsert: true });

  if (error) throw error;

  const { data } = supabase.storage
    .from('vendor-images')
    .getPublicUrl(path);

  return data.publicUrl;  // store this URL in vendors.logo_url or vendors.cover_image_url
};
```

### 9.3 React Native Image Upload

Use `react-native-image-picker` or `expo-image-picker` to select images, then convert to a Blob for upload:

```typescript
import * as ImagePicker from 'expo-image-picker';

const pickAndUpload = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
  });

  if (!result.canceled) {
    const uri = result.assets[0].uri;
    const response = await fetch(uri);
    const blob = await response.blob();
    const url = await uploadMenuImage(blob, 'item.jpg');
    return url;
  }
};
```

**Public URL pattern:**
```
https://jxkmsdwqaxcqrqtmwlln.supabase.co/storage/v1/object/public/menu-images/{path}
https://jxkmsdwqaxcqrqtmwlln.supabase.co/storage/v1/object/public/vendor-images/{path}
```

---

## 10. Cart Logic (Client-Side)

The cart is entirely client-side (no DB table). In React Native, persist with AsyncStorage.

### Cart State Structure

```typescript
interface CartItem {
  menuItemId: string;
  name: string;
  price: number;           // unit price in NGN
  quantity: number;
  imageUrl?: string;
}

interface CartState {
  vendorId: string | null;    // single-vendor enforcement
  vendorName: string | null;
  items: CartItem[];
}
```

### Business Rules

- **Single vendor per cart:** Adding an item from a different vendor resets the cart. Always warn the user before clearing.
- **Persistence:** Save to AsyncStorage after every change. Key: `fooda_cart`.
- **Derived values:**
  ```typescript
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal  = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const tax       = subtotal * taxRate;       // taxRate from platform_settings
  const total     = subtotal + tax + deliveryFee;  // deliveryFee from platform_settings
  ```

### Cart Operations

```typescript
// Add item (resets cart if different vendor)
addItem(vendorId, vendorName, { menuItemId, name, price, imageUrl });

// Remove item completely
removeItem(menuItemId);

// Change quantity (quantity <= 0 removes the item)
updateQuantity(menuItemId, newQuantity);

// Clear entire cart (call after successful order)
clearCart();
```

---

## 11. Payment Flow (Paystack)

Paystack is the sole payment processor. Currency: NGN (Nigerian Naira, ₦).

### Complete Mobile Flow

```
1. Customer fills delivery address on checkout screen
2. App fetches delivery_fee and tax_rate from platform_settings
3. App calls create-order edge function → receives orderId
4. App calls process-payment edge function → receives payment_url
5. App opens payment_url in:
   - WebView (in-app): recommended for seamless UX
   - Linking.openURL: opens device browser
6. After payment, Paystack redirects to callback_url
   - Deep link triggers app foreground
   - App extracts ?reference= from the URL
7. App polls orders table for payment_status (max 8 × 2 seconds)
8. On 'completed': clear cart, navigate to order tracking
9. On 'failed':    show error, offer retry
10. On timeout:    show 'pending' state, link to order history
```

### Paystack Environment

- **Test key** (currently active): `pk_test_86f13bab0a38498ee1de7be9352d5fd3e94f731c`
- **Live key**: Replace before production launch (update `VITE_PAYSTACK_PUBLIC_KEY` in Vercel env)
- **Webhook**: Supabase Edge Function `process-payment` handles Paystack webhooks to update `payment_status` and `payment_reference` on the order

### Deep Link Configuration (React Native)

```typescript
// App.tsx
import { Linking } from 'react-native';

useEffect(() => {
  const subscription = Linking.addEventListener('url', ({ url }) => {
    if (url.startsWith('fooda://payment/callback')) {
      const params = new URLSearchParams(url.split('?')[1]);
      const reference = params.get('reference') ?? params.get('trxref');
      if (reference) navigation.navigate('PaymentCallback', { reference });
    }
  });
  return () => subscription.remove();
}, []);
```

---

## 12. App Routes & Screen Map

| Screen | Route / Deep Link | Auth Required | Role |
|--------|------------------|---------------|------|
| Landing / Home | `/` | No | All |
| Auth (Login / Register) | `/auth` | No | Unauthenticated |
| Restaurant List | `/restaurants` | No | Customer |
| Restaurant Detail | `/restaurants/:id` | No | Customer |
| Checkout | `/restaurants/:id/checkout` | Yes | Customer |
| Payment Callback | `/payment/callback` | No | Customer |
| Order Tracking | `/orders/:id` | Yes | Customer |
| Order History | `/orders` | Yes | Customer |
| Profile | `/profile` | Yes | Customer |
| Notifications | `/notifications` | Yes | Customer |
| Vendor Dashboard | `/vendor/*` | Yes | Vendor |
| Admin Dashboard | `/admin/*` | Yes | Admin |

### Vendor Dashboard Tabs

| Tab | Content |
|-----|---------|
| Orders | Live order feed; filter by status; expandable rows |
| Menu | Item grid with search/category filter; add/edit/delete |
| Analytics | Revenue chart, order counts, avg order value, top items |
| Settings | Restaurant profile, hours, logo/cover upload |

### Admin Dashboard Tabs

| Tab | Content |
|-----|---------|
| Overview | Stats cards, recent orders |
| Vendors | List all vendors; activate/deactivate; edit profiles |
| Orders | All platform orders with status management |
| Users | All users; role management |
| Settings | Platform settings (delivery fee, tax rate, etc.) |

---

## 13. Branding & Design System

### 13.1 Brand Identity

- **App Name:** Fooda
- **Tagline:** Delicious Food Delivered to Your Doorstep
- **Logo:** Fork and knife icon (🍴) + wordmark "Fooda"
- **Favicon/App Icon:** Orange fork-and-knife SVG on transparent background

### 13.2 Colour Palette

```
Brand Orange (Primary)    #ff6b35   ← CTA buttons, active states, price labels, logo
Brand Orange Dark         #e55a2b   ← Hover / pressed state for primary button
Brand Orange Light        #fff7ed   ← Background tint for notification cards (unread)
Brand Orange Border       #fed7aa   ← Border for highlighted cards

Dark Navy (Background accent)  #1a1a2e   ← Auth gradient background
Near Black                     #1a1a1a   ← Primary body text
Dark Grey                      #444444   ← Secondary text / labels
Medium Grey                    #666666   ← Tertiary text
Light Grey (text)              #888888   ← Placeholder, captions
Border Grey                    #e5e7eb   ← Input borders
Surface Border                 #f0f0f0   ← Card/section dividers
Background                     #f8f9fa   ← Page background

Success Green     #16a34a   ← Delivered, completed, success states
Success Light     #dcfce7   ← Success background
Info Blue         #3b82f6   ← Confirmed, info states
Info Light        #dbeafe   ← Info background
Warning Amber     #f59e0b   ← Pending, processing states
Warning Light     #fef3c7   ← Warning background
Error Red         #dc2626   ← Failed, cancelled, errors
Error Light       #fee2e2   ← Error background
Purple            #8b5cf6   ← Preparing state
Purple Light      #ede9fe   ← Preparing background
Cyan              #06b6d4   ← Ready for pickup state
Cyan Light        #cffafe   ← Ready background
```

### 13.3 Typography

**Landing/Marketing pages:** Poppins (Google Fonts)  
**App UI (all dashboards, customer screens):** Inter → system-ui → sans-serif

```
Font Stack: 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', sans-serif
```

**Scale:**
```
Hero / Display:    32–48px  weight 800–900
Page Title:        24–28px  weight 700–800
Section Header:    18–22px  weight 700
Card Title:        16–17px  weight 700
Body:              14–15px  weight 400–500
Caption / Label:   12–13px  weight 400–600
Micro:             10–11px  weight 400–700
```

**Currency display:** Always ₦ prefix, no decimals for whole amounts  
```typescript
const formatPrice = (n: number) =>
  '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
// ₦2,500  ₦14,750
```

### 13.4 Spacing System

Base unit: **4px**

```
xs:  4px
sm:  8px
md:  12–16px
lg:  20–24px
xl:  28–32px
2xl: 40–48px
```

### 13.5 Border Radius

```
Input fields:     10–12px
Cards:            14–16px
Modals:           20px
Buttons (pill):   30px (landing), 10–12px (app UI)
Status badges:    20px (pill)
Avatar/circles:   50%
```

### 13.6 Shadows

```
Card shadow:   0 1px 6px rgba(0,0,0,0.06)
Modal shadow:  0 20px 60px rgba(0,0,0,0.20)
Header shadow: 0 2px 10px rgba(0,0,0,0.10)
Input focus:   none (outline: none, rely on border-color change)
CTA shadow:    0 4px 12px rgba(255,107,53,0.30)  ← orange glow on hover
```

### 13.7 Component Patterns

**Primary Button:**
```
Background: #ff6b35
Text: #ffffff  weight 700  size 15–16px
Border radius: 12px (app) / 30px (landing)
Padding: 12–14px vertical, full width where applicable
Disabled: background #cccccc, cursor not-allowed
```

**Outline Button:**
```
Background: transparent
Border: 2px solid #ff6b35
Text: #ff6b35  weight 600
Hover: background #ff6b35, text #ffffff
```

**Status Badge:**
```
Background: status-color + '20' (20% opacity hex)
Text: status-color  weight 600  size 12–13px
Border radius: 20px  padding: 4px 10–12px
Text transform: capitalize
```

**Card:**
```
Background: #ffffff
Border: 1px solid #f0f0f0
Active/selected: border 2px solid #ff6b35
Border radius: 14–16px
Padding: 16–24px
Shadow: 0 1px 6px rgba(0,0,0,0.06)
```

**Input Field:**
```
Border: 1px solid #e5e7eb
Border radius: 10px
Padding: 10–13px 14px
Font size: 15px
Focus: outline none (add border-color: #ff6b35 on focus for mobile)
```

**Avatar (initials fallback):**
```
Size: 40–64px circle
Background: linear-gradient(135deg, #ff6b35, #f7931e)
Text: #ffffff  weight 700
Content: first letter of full_name or email uppercased
```

### 13.8 Auth Gradient Background

```css
background: linear-gradient(135deg, #ff6b35 0%, #f7931e 50%, #1a1a2e 100%);
```

### 13.9 Hero Section Background

```css
background: linear-gradient(135deg, #ff6b35, #f7931e);
/* Text over hero: #ffffff */
```

### 13.10 Notification Card (Unread vs Read)

```
Unread:  background #fff7ed  border 1px solid #fed7aa
Read:    background #ffffff  border 1px solid #f0f0f0
Unread dot: 8px circle #ff6b35 (top-right)
```

---

## 14. Business Rules & Validation

### Registration
- Password minimum: **6 characters**
- Email must be unique (Supabase enforces)
- Vendor registration automatically creates a `vendors` row (trigger)
- Customer registration automatically creates a `users` row (trigger)

### Orders
- **Minimum order amount:** ₦1,000 (from `platform_settings.min_order_amount`)
- **Cart is single-vendor:** Adding items from a different restaurant clears the cart
- Delivery address requires at minimum: `street`, `city`, `phone`
- Order number format: `ORD-YYYYMMDD-XXXX` (generated by edge function)
- Orders are immutable once placed — only `status` and `payment_status` can be updated

### Pricing
- **Tax rate:** 7.5% (from `platform_settings.tax_rate`)
- **Delivery fee:** ₦500 flat (from `platform_settings.delivery_fee`)
- Item prices are snapshotted into `order_items.price_per_unit` at time of order — menu price changes do not affect existing orders
- Currency: **NGN (₦)** — all amounts in Naira

### Reviews
- Only customers who have a `delivered` order from that vendor can submit a review
- One review per (customer + vendor + order) — duplicate insert returns error code `23505`
- Reviews are not publicly visible until `is_verified = true` (set by admin)

### Notifications
- Notifications are created server-side by edge functions
- `order_id` is nullable — only set if the notification links to an order
- Tapping a notification with `order_id` navigates to the order tracking screen
- Notifications with no `order_id` are non-tappable informational items

### Vendors
- A vendor is visible to customers only when `is_active = true`
- An inactive vendor's orders already in progress remain accessible to the customer
- `business_hours` is informational — the app computes open/closed status client-side

### Open/Closed Status Computation

```typescript
const getTodayStatus = (businessHours: Record<string, any>) => {
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const today = days[new Date().getDay()];
  const hours = businessHours?.[today];
  if (!hours?.is_open) return { isOpen: false, hours: null };

  const now = new Date();
  const [openH, openM]   = hours.open.split(':').map(Number);
  const [closeH, closeM] = hours.close.split(':').map(Number);
  const openMins  = openH * 60 + openM;
  const closeMins = closeH * 60 + closeM;
  const nowMins   = now.getHours() * 60 + now.getMinutes();

  return {
    isOpen: nowMins >= openMins && nowMins < closeMins,
    hours: `${hours.open} – ${hours.close}`,
  };
};
```

---

## 15. Error Handling Patterns

### Supabase Error Codes

```typescript
// Check for constraint violations:
if (error.code === '23505') // unique_violation — duplicate review
if (error.code === '23503') // foreign_key_violation
if (error.code === '42501') // insufficient_privilege — RLS denied
if (error.code === 'PGRST301') // JWT expired

// Check error message for human-readable detail:
const message = error.message ?? 'Something went wrong. Please try again.';
```

### Auth Errors to Handle

```
'Invalid login credentials'   → Wrong email/password
'Email not confirmed'         → User hasn't verified email
'User already registered'     → Email taken (sign-up)
'Password should be at least 6 characters'
```

### Network / Timeout Strategy

- Set a 4-second timeout on the role fetch at startup
- Payment verification polling: 8 attempts × 2 seconds = 16 seconds max, then show "pending"
- Edge function calls: handle `fnError` (network/function error) AND `data.error` (business logic error) separately

```typescript
const { data, error: fnErr } = await supabase.functions.invoke('create-order', { body });
if (fnErr) throw new Error(`Network error: ${fnErr.message}`);
if (data?.error) throw new Error(data.error); // business logic error from the function
```

---

## 16. Platform Settings (Dynamic Config)

These settings are fetched at runtime and must not be hardcoded in the app. Fetch once per session or per checkout, not on every API call.

```typescript
// Recommended: cache in app state / context
const loadPlatformConfig = async () => {
  const { data } = await supabase
    .from('platform_settings')
    .select('setting_key, setting_value, setting_type');

  return Object.fromEntries(
    (data ?? []).map(({ setting_key, setting_value, setting_type }) => {
      let value: any = setting_value;
      if (setting_type === 'number')  value = parseFloat(setting_value);
      if (setting_type === 'boolean') value = setting_value === 'true';
      if (setting_type === 'json')    value = JSON.parse(setting_value);
      return [setting_key, value];
    })
  );
};

// Usage:
const config = await loadPlatformConfig();
const deliveryFee = config.delivery_fee;    // 500
const taxRate = config.tax_rate / 100;      // 0.075
```

---

## 17. React Native Setup Checklist

### Required Dependencies

```bash
# Supabase
npm install @supabase/supabase-js @react-native-async-storage/async-storage

# Navigation
npm install @react-navigation/native @react-navigation/stack @react-navigation/bottom-tabs
npm install react-native-screens react-native-safe-area-context

# Image handling
npm install expo-image-picker   # or react-native-image-picker

# Deep linking (payment callbacks)
# iOS: configure Info.plist URL schemes
# Android: configure AndroidManifest.xml intent filters

# Optional: real-time push notifications
npm install @notifee/react-native   # local notifications
npm install @react-native-firebase/app @react-native-firebase/messaging  # FCM
```

### AsyncStorage Setup (iOS + Android)

For Expo: `npx expo install @react-native-async-storage/async-storage`  
For bare RN: `npm install @react-native-async-storage/async-storage && npx pod-install`

### Deep Link Scheme

Register `fooda://` as the URL scheme in both platforms:

**iOS (Info.plist):**
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>fooda</string>
    </array>
  </dict>
</array>
```

**Android (AndroidManifest.xml):**
```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="fooda" />
</intent-filter>
```

### Network Permissions (Android)

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

### Supabase Realtime (React Native)

Realtime works out of the box with the JS SDK in React Native. Ensure WebSocket connectivity is not blocked. On Android, Realtime channels may need to be re-subscribed after the app returns from background — subscribe in a `useEffect` with `AppState` listener.

```typescript
import { AppState } from 'react-native';

useEffect(() => {
  const subscription = AppState.addEventListener('change', state => {
    if (state === 'active') {
      supabase.realtime.setAuth(session?.access_token ?? null);
    }
  });
  return () => subscription.remove();
}, [session]);
```

---

*This document was generated from the live Fooda codebase at commit state 2026-04-27. The web app is deployed at https://foodaweb.vercel.app/ and the Supabase project is at https://jxkmsdwqaxcqrqtmwlln.supabase.co.*
