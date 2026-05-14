# FOODA — React Native App: AI Agent Master Prompt

---

You are an expert React Native engineer tasked with building **Fooda**, a production-grade multi-vendor food ordering and delivery mobile application. This is NOT an MVP. It is a polished, shippable, consumer-facing product.

Read every section of this prompt in full before writing a single line of code. Do not skip sections. Do not make assumptions — everything you need is documented here.

---

## PART 1: PROJECT CONTEXT

**App Name:** Fooda  
**Tagline:** Delicious Food Delivered to Your Doorstep  
**Live Web App (reference):** https://foodaweb.vercel.app/  
**Platform:** iOS + Android (React Native, Expo or bare workflow)  
**Currency:** Nigerian Naira (NGN, ₦)  
**Market:** Nigeria  
**Backend:** Supabase (PostgreSQL + Auth + Realtime + Storage + Edge Functions)  
**Payment:** Paystack  

The backend is 100% Supabase — there is no custom REST API server. All data access uses the Supabase JS/TS SDK directly.

### User Roles

There are four roles. Build screens for the first three:

| Role | Description | App |
|------|-------------|-----|
| `customer` | Browses restaurants, places orders, tracks delivery, writes reviews | ✅ Build |
| `vendor` | Manages restaurant profile, menu, incoming orders, analytics | ✅ Build |
| `admin` | Platform oversight — users, vendors, financials, settings | ✅ Build |
| `delivery_person` | Schema-ready but no mobile app required | ❌ Skip |

After login, route each role to their own stack immediately. A `vendor` must never land on a customer screen and vice versa.

---

## PART 2: SUPABASE CONFIGURATION

```
Project URL:  https://jxkmsdwqaxcqrqtmwlln.supabase.co
Anon Key:     eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4a21zZHdxYXhjcXJxdG13bGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMzQ3NzUsImV4cCI6MjA5MjYxMDc3NX0.ZEYWRGvmr-zkxjdsZbzrbI6V6AXiaM6rgfvDkfQNwc4
Paystack Key: pk_test_86f13bab0a38498ee1de7be9352d5fd3e94f731c
```

### Supabase Client Initialization

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const supabase = createClient(
  'https://jxkmsdwqaxcqrqtmwlln.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4a21zZHdxYXhjcXJxdG13bGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMzQ3NzUsImV4cCI6MjA5MjYxMDc3NX0.ZEYWRGvmr-zkxjdsZbzrbI6V6AXiaM6rgfvDkfQNwc4',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,   // REQUIRED for React Native
    },
  }
);
```

### Required Packages

```bash
npx expo install @supabase/supabase-js
npx expo install @react-native-async-storage/async-storage
npx expo install expo-image-picker
npx expo install expo-linking
npx expo install expo-constants
npx expo install @react-navigation/native @react-navigation/stack @react-navigation/bottom-tabs
npx expo install react-native-screens react-native-safe-area-context
npx expo install react-native-gesture-handler
npx expo install react-native-reanimated
npx expo install react-native-vector-icons   # or expo/vector-icons
npx expo install @shopify/flash-list          # performant list replacement for FlatList
```

---

## PART 3: AUTHENTICATION

### Sign Up — Customer

```typescript
await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { role: 'customer', full_name: fullName },
  },
});
```

### Sign Up — Vendor

```typescript
await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { role: 'vendor', business_name: restaurantName, full_name: restaurantName },
  },
});
```

### Sign In

```typescript
const { data, error } = await supabase.auth.signInWithPassword({ email, password });
```

### Get Role (ALWAYS from DB — never trust JWT metadata)

```typescript
const { data } = await supabase
  .from('users')
  .select('role')
  .eq('id', session.user.id)
  .single();
const role = data?.role ?? 'customer';
```

### Route by Role

```
'admin'    → Admin Navigator
'vendor'   → Vendor Navigator
'customer' → Customer Navigator
```

### Auth State Listener

```typescript
supabase.auth.onAuthStateChange(async (event, session) => {
  if (session?.user) {
    const { data } = await supabase.from('users').select('role').eq('id', session.user.id).single();
    setRole(data?.role ?? 'customer');
  } else {
    setRole(null);
  }
});
```

### AppState — Supabase Realtime Reconnection

```typescript
import { AppState } from 'react-native';
AppState.addEventListener('change', state => {
  if (state === 'active') supabase.realtime.setAuth(session?.access_token ?? null);
});
```

### Email Verification

After sign-up without an active session, show: "Please check your email to confirm your account, then log in." Do NOT auto-navigate.

---

## PART 4: DATABASE SCHEMA (Complete)

### `users`
```
id UUID PK | email TEXT UNIQUE | phone TEXT | full_name TEXT | avatar_url TEXT
role TEXT ['customer','vendor','delivery_person','admin'] DEFAULT 'customer'
is_active BOOLEAN DEFAULT true | created_at TIMESTAMPTZ | updated_at TIMESTAMPTZ
```

### `vendors` (restaurants)
```
id UUID PK | owner_id UUID FK→users | name TEXT | description TEXT
address JSONB {street, area, city, state, country}
phone TEXT | email TEXT
business_hours JSONB {monday:{open,close,is_open}, tuesday:..., ...sunday}
logo_url TEXT | cover_image_url TEXT
is_active BOOLEAN DEFAULT true | created_at TIMESTAMPTZ | updated_at TIMESTAMPTZ
```

### `menu_categories`
```
id UUID PK | vendor_id UUID FK→vendors | name TEXT | description TEXT
is_active BOOLEAN | sort_order INTEGER DEFAULT 0 | created_at TIMESTAMPTZ
```

### `menu_items`
```
id UUID PK | vendor_id UUID FK→vendors | category_id UUID FK→menu_categories (nullable)
name TEXT | description TEXT | price DECIMAL(10,2) [NGN]
image_url TEXT | is_available BOOLEAN | is_vegetarian BOOLEAN | is_vegan BOOLEAN
prep_time INTEGER [minutes] | sort_order INTEGER | created_at TIMESTAMPTZ | updated_at TIMESTAMPTZ
```

### `menu_item_addons`
```
id UUID PK | menu_item_id UUID FK→menu_items ON DELETE CASCADE
name TEXT | price DECIMAL(10,2) [0=free] | is_available BOOLEAN
sort_order INTEGER | created_at TIMESTAMPTZ | updated_at TIMESTAMPTZ
```

### `user_addresses`
```
id UUID PK | user_id UUID FK→users | title TEXT ['Home','Work',etc]
address_line1 TEXT [street] | address_line2 TEXT [area/neighbourhood]
city TEXT | state TEXT | postal_code TEXT | country TEXT
latitude DECIMAL(10,8) | longitude DECIMAL(11,8)
is_default BOOLEAN DEFAULT false | created_at TIMESTAMPTZ
```

### `orders`
```
id UUID PK | customer_id UUID FK→users | vendor_id UUID FK→vendors
delivery_person_id UUID FK→users (nullable)
order_number TEXT UNIQUE | status TEXT | subtotal DECIMAL | tax_amount DECIMAL
delivery_fee DECIMAL | total_amount DECIMAL
payment_method TEXT ['cash','card','paypal','wallet']
payment_status TEXT ['pending','completed','failed','refunded']
payment_reference TEXT [Paystack reference]
delivery_address JSONB {street, area, city} [snapshot at order time]
delivery_latitude DECIMAL | delivery_longitude DECIMAL
estimated_prep_time INTEGER | estimated_delivery_time TIMESTAMPTZ
actual_delivery_time TIMESTAMPTZ | notes TEXT
created_at TIMESTAMPTZ | updated_at TIMESTAMPTZ
```

**Order Status Flow:**
```
pending → confirmed → preparing → ready_for_pickup → picked_up → delivered
Any non-delivered status can transition → cancelled
```

### `order_items`
```
id UUID PK | order_id UUID FK→orders ON DELETE CASCADE
menu_item_id UUID FK→menu_items ON DELETE SET NULL (nullable — item may be deleted)
quantity INTEGER | price_per_unit DECIMAL [snapshot] | total_price DECIMAL
special_instructions TEXT | created_at TIMESTAMPTZ
```

### `reviews`
```
id UUID PK | customer_id UUID FK→users | vendor_id UUID FK→vendors
order_id UUID FK→orders [REQUIRED — must be a delivered order]
rating INTEGER [1–5] | comment TEXT | is_verified BOOLEAN DEFAULT false
created_at TIMESTAMPTZ | updated_at TIMESTAMPTZ
UNIQUE(customer_id, vendor_id, order_id)
```
Only reviews where `is_verified = true` are publicly visible.

### `notifications`
```
id UUID PK | user_id UUID FK→users | vendor_id UUID FK→vendors
order_id UUID FK→orders ON DELETE SET NULL (nullable)
type TEXT ['order_created','order_status_update','payment_received','delivery_assigned','custom','system']
title TEXT | message TEXT | is_read BOOLEAN DEFAULT false | created_at TIMESTAMPTZ
```

### `wallet_transactions`
```
id UUID PK | user_id UUID FK→users | order_id UUID FK→orders
transaction_type TEXT ['credit','debit'] | amount DECIMAL
balance_after DECIMAL | description TEXT | created_at TIMESTAMPTZ
```

### `platform_settings`
```
id UUID PK | setting_key TEXT UNIQUE | setting_value TEXT
setting_type TEXT ['string','number','boolean','json']
description TEXT | updated_at TIMESTAMPTZ | updated_by UUID FK→users
```
**Default values:**
```
delivery_fee        = 500     (NGN)
tax_rate            = 7.5     (percent)
commission_rate     = 15      (percent)
min_order_amount    = 1000    (NGN)
max_delivery_distance = 10   (km)
platform_name       = Fooda
support_email       = support@fooda.com
support_phone       = +234-XXX-XXX-XXXX
```

---

## PART 5: COMPLETE SCREEN LIST & NAVIGATION STRUCTURE

### Root Navigation

```
RootNavigator
├── AuthStack (when no session)
│   ├── SplashScreen
│   ├── OnboardingScreen  (3 slides: Order food, Track delivery, Enjoy meals)
│   ├── LoginScreen
│   ├── RegisterCustomerScreen
│   └── RegisterVendorScreen
│
├── CustomerStack (role = 'customer')
├── VendorStack   (role = 'vendor')
└── AdminStack    (role = 'admin')
```

---

### CUSTOMER STACK

```
CustomerTabNavigator (Bottom Tabs)
├── HomeTab
│   └── RestaurantListScreen        /restaurants
│       └── RestaurantDetailScreen  /restaurants/:id
│           └── CheckoutScreen      /restaurants/:id/checkout
│               └── PaymentCallbackScreen  /payment/callback
│
├── OrdersTab
│   └── OrderHistoryScreen          /orders
│       └── OrderTrackingScreen     /orders/:id
│
├── NotificationsTab
│   └── NotificationsScreen         /notifications
│
└── ProfileTab
    └── ProfileScreen               /profile
        ├── EditProfileScreen
        └── AddressesScreen
```

**Bottom Tab Bar Design:**
- Icons: 🏠 Home | 📦 Orders | 🔔 Notifications (badge) | 👤 Profile
- Active: `#ff6b35` | Inactive: `#888888`
- Badge on Notifications tab showing unread count

---

### VENDOR STACK

```
VendorTabNavigator (Bottom Tabs)
├── OrdersTab     → VendorOrdersScreen
├── MenuTab       → VendorMenuScreen
├── AnalyticsTab  → VendorAnalyticsScreen
└── SettingsTab   → VendorSettingsScreen
```

**Bottom Tab Bar Design:**
- Icons: 📋 Orders | 🍽️ Menu | 📊 Analytics | ⚙️ Settings
- Active: `#ff6b35` | Inactive: `#888888`

---

### ADMIN STACK

```
AdminTabNavigator (Bottom Tabs)
├── OverviewTab    → AdminOverviewScreen
├── VendorsTab     → AdminVendorsScreen
├── OrdersTab      → AdminOrdersScreen
├── UsersTab       → AdminUsersScreen
└── SettingsTab    → AdminPlatformSettingsScreen
```

---

## PART 6: ALL SCREENS — DETAILED SPECIFICATIONS

---

### SCREEN: SplashScreen

- Full-screen brand gradient: `linear-gradient(135deg, #ff6b35, #f7931e)`
- Centered Fooda fork-knife logo (white, large) + "Fooda" wordmark below in white, weight 900
- Auto-navigate after 2 seconds:
  - If session exists → fetch role → correct stack
  - If no session → OnboardingScreen (first launch) or LoginScreen (returning user)
- Use AsyncStorage key `fooda_onboarding_complete` to decide first launch

---

### SCREEN: OnboardingScreen

Three swipeable slides. Show only on first launch.

| Slide | Illustration | Title | Subtitle |
|-------|-------------|-------|---------|
| 1 | 🍕 food bowl | Discover Great Food | Explore hundreds of restaurants and thousands of dishes |
| 2 | 🛵 delivery rider | Fast Delivery | Track your order in real-time from kitchen to doorstep |
| 3 | 🎉 happy customer | Enjoy Every Bite | Rate your experience and reorder your favourites in seconds |

- Dot pagination indicator (active dot: `#ff6b35`, inactive: `#e5e7eb`)
- "Skip" button top-right
- "Next" button; last slide shows "Get Started"
- On complete: set `fooda_onboarding_complete = true` in AsyncStorage, navigate to LoginScreen

---

### SCREEN: LoginScreen

- Brand gradient background (`linear-gradient(135deg, #ff6b35 0%, #f7931e 50%, #1a1a2e 100%)`)
- White card (borderRadius 24, shadow)
- "Fooda" logo in `#ff6b35` centered at top
- Email + Password inputs
- "Sign In" primary button (`#ff6b35`)
- Links to RegisterCustomerScreen and RegisterVendorScreen
- "Forgot Password?" link → supabase.auth.resetPasswordForEmail(email)
- On success: fetch DB role → navigate to correct stack
- Error states: wrong password, unconfirmed email, network error

---

### SCREEN: RegisterCustomerScreen

- Same gradient background + white card
- Fields: Full Name, Email, Password (min 6 chars), Confirm Password
- "Create Account" primary button
- Link to LoginScreen
- On success: if `session` exists → navigate to CustomerStack; else → "Check your email to confirm"

---

### SCREEN: RegisterVendorScreen

- Same gradient background + white card
- Fields: Restaurant Name, Email, Password, Confirm Password
- "Register Restaurant" primary button
- Explain: "Your restaurant profile will be created automatically"
- On success: navigate to VendorStack

---

### SCREEN: RestaurantListScreen (Customer Home)

**Header (non-scrollable, sticky):**
- Brand orange gradient background
- "🍴 Fooda" logo (white) left | 🔔 notification bell right (with unread badge count)
- Location label below logo ("Delivering to Lagos" or user's city if available)
- Search bar with rounded corners: white background, placeholder "Search restaurants or cuisines…" in light grey `rgba(180,180,180,0.9)`, 🔍 icon

**Content (scrollable):**

1. **Banner/Hero Carousel** (if 2+ active vendors): auto-scrolling horizontal pager with vendor cover images, name overlay, "Order Now" CTA — auto-advances every 4 seconds

2. **"Order Again" Section** (visible only if customer has past orders):
   - Horizontal scroll of last 3 unique vendors ordered from
   - Fetch: most recent distinct vendors from customer's orders
   - Each card: vendor logo (50px circle), name, "Order Again →"

3. **"All Restaurants" Section:**
   - Grid (2 columns on phone, 3 on tablet) of RestaurantCards
   - Filter pills (horizontal scroll): All | Open Now | ⭐ Top Rated | New
   - Each card (RestaurantCard):
     - Cover image (aspect ratio 16:9, rounded corners)
     - Logo overlapping bottom-left corner (40px circle with white border)
     - Restaurant name (weight 700)
     - Cuisine/description (1 line, truncated, grey)
     - ⭐ Average rating + review count
     - 🕐 Today's hours (open/closed badge)
     - Delivery fee tag "₦500 delivery"
   - Skeleton loaders while fetching

**Data Queries:**
```typescript
// All active restaurants
const { data: vendors } = await supabase
  .from('vendors')
  .select('id, name, description, address, phone, logo_url, cover_image_url, business_hours')
  .eq('is_active', true)
  .order('name');

// Average ratings (batch fetch)
const { data: ratings } = await supabase
  .from('reviews')
  .select('vendor_id, rating')
  .eq('is_verified', true);
// Group client-side by vendor_id

// Unread notification count (for bell badge)
const { count } = await supabase
  .from('notifications')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', userId)
  .eq('is_read', false);

// Recent vendors (Order Again)
const { data: recentOrders } = await supabase
  .from('orders')
  .select('vendor_id, vendor:vendors(id, name, logo_url)')
  .eq('customer_id', userId)
  .order('created_at', { ascending: false })
  .limit(10);
```

**Search:** Client-side filter on `name` and `description` fields (case-insensitive). If search query present, hide banner and Order Again section; show "Results for X" header above the grid.

**Open/Closed Logic (client-side):**
```typescript
const getTodayStatus = (businessHours) => {
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const today = days[new Date().getDay()];
  const hours = businessHours?.[today];
  if (!hours?.is_open) return { isOpen: false, label: 'Closed today' };
  const now = new Date();
  const [oh, om] = hours.open.split(':').map(Number);
  const [ch, cm] = hours.close.split(':').map(Number);
  const nowM = now.getHours() * 60 + now.getMinutes();
  const isOpen = nowM >= oh * 60 + om && nowM < ch * 60 + cm;
  return { isOpen, label: isOpen ? `Open · closes ${hours.close}` : `Opens ${hours.open}` };
};
```

**Pull-to-refresh:** Re-fetch vendors and ratings.

---

### SCREEN: RestaurantDetailScreen

Navigate from RestaurantListScreen with `vendorId` param.

**Layout:**

1. **Hero Section:**
   - Full-width cover image (height 220px)
   - Gradient overlay bottom (transparent → rgba(0,0,0,0.6))
   - Back button (←) top-left on image
   - Share button top-right on image
   - Restaurant name (white, large, weight 800) at bottom of image
   - Open/Closed badge (green or red pill) overlaid on name

2. **Info Strip** (white card, sticky below hero on scroll):
   - Logo (50px circle)
   - Address: `📍 {street}, {area}, {city}`
   - Phone: `📞 {phone}` (tappable → `Linking.openURL('tel:...')`)
   - Today's hours: `🕐 Opens 09:00 – 22:00` (expandable for full week schedule)
   - Average rating: `⭐ 4.8 (24 reviews)`

3. **"Featured Items"** (horizontal scroll, first 6 items across all categories)

4. **Menu Sections** (vertical list grouped by category):
   - Category header (weight 700, size 17, sticky while scrolling through that category)
   - Grid of MenuItemCards (2 columns)

5. **Reviews Section:**
   - Show top 5 verified reviews
   - Each: star rating, comment, customer name, date
   - Review submission form (only if user is logged in + has a delivered order from this vendor):
     - Star picker (1–5)
     - Comment textarea
     - "Submit Review" button

**MenuItemCard:**
- Image (aspect 4:3, rounded corners) or placeholder food icon
- Name (weight 700)
- Description (2 lines max, truncated)
- Price (`₦2,500` weight 700, brand orange)
- Veg badge (🌱) if `is_vegetarian`
- Vegan badge (🌿) if `is_vegan`
- Prep time (`⏱ 20 min`)
- `+` add-to-cart button (brand orange circle)
- On press: if item has addons → show AddonsBottomSheet; else → add to cart directly

**AddonsBottomSheet:**
- Scrollable bottom sheet
- List of available addons with name + price
- Multi-select checkboxes
- Quantity selector
- "Add to Cart ₦X,XXX" button

**Cart FAB (Floating Action Button):**
- Visible when cart has items
- Bottom-center, brand orange pill: "🛒 View Cart · {itemCount} items · ₦{subtotal}"
- Tapping navigates to CheckoutScreen

**Data Queries:**
```typescript
// Restaurant + categories + items
const { data: vendor } = await supabase
  .from('vendors')
  .select(`
    id, name, description, address, phone, email,
    logo_url, cover_image_url, business_hours,
    categories:menu_categories(
      id, name, sort_order, is_active,
      items:menu_items(
        id, name, description, price, image_url,
        is_available, is_vegetarian, is_vegan, prep_time, sort_order
      )
    )
  `)
  .eq('id', vendorId)
  .single();

// Reviews
const { data: reviews } = await supabase
  .from('reviews')
  .select('id, rating, comment, created_at, customer:users(full_name)')
  .eq('vendor_id', vendorId)
  .eq('is_verified', true)
  .order('created_at', { ascending: false })
  .limit(10);

// Addons (lazy: fetch when item card is pressed)
const { data: addons } = await supabase
  .from('menu_item_addons')
  .select('id, name, price, sort_order')
  .eq('menu_item_id', menuItemId)
  .eq('is_available', true)
  .order('sort_order');

// Check review eligibility
const { data: eligibleOrder } = await supabase
  .from('orders')
  .select('id')
  .eq('customer_id', userId)
  .eq('vendor_id', vendorId)
  .eq('status', 'delivered')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();
```

**Submit Review:**
```typescript
await supabase.from('reviews').insert({
  customer_id: userId,
  vendor_id: vendorId,
  order_id: eligibleOrder.id,
  rating,
  comment: comment || null,
});
// On error code '23505': "You have already reviewed this order"
```

---

### SCREEN: CheckoutScreen

Accessible only when cart is non-empty and user is logged in.

**Sections:**
1. **Header:** Back arrow + "Checkout" title

2. **Delivery Address:**
   - If user has saved addresses: show them as selectable cards (default pre-selected)
   - "Add new address" option at bottom of list
   - Fields: Street Address*, Area/Neighbourhood, City*, Phone Number*
   - Delivery Notes (optional textarea)

3. **Order Summary:**
   - List of cart items: name × qty → ₦total
   - Subtotal
   - Tax (7.5%)
   - Delivery Fee (₦500)
   - **Total in brand orange (₦X,XXX)**

4. **Payment Button:**
   - `Pay ₦X,XXX via Paystack`
   - Background: `#ff6b35`
   - Show Paystack logo/lock icon below: "🔒 Secured by Paystack"
   - Disabled + grey while loading

**On Submit:**
```typescript
// 1. Fetch platform settings
const { data: settings } = await supabase
  .from('platform_settings')
  .select('setting_key, setting_value')
  .in('setting_key', ['delivery_fee', 'tax_rate']);

// 2. Call create-order edge function
const { data: orderData, error: orderErr } = await supabase.functions.invoke('create-order', {
  body: {
    vendor_id: vendorId,
    items: cartItems.map(i => ({ menu_item_id: i.menuItemId, quantity: i.quantity })),
    delivery_address: { street, area, city },
    notes: notes || null,
  },
});
const orderId = orderData?.order?.id;

// 3. Call process-payment edge function
const { data: payData } = await supabase.functions.invoke('process-payment', {
  body: {
    order_id: orderId,
    amount: totalAmount,
    email: user.email,
    callback_url: 'fooda://payment/callback',  // deep link for mobile
  },
});

// 4. Open Paystack in WebView (in-app) or browser
if (payData?.payment_url) {
  navigation.navigate('PaymentWebView', { url: payData.payment_url });
}
```

---

### SCREEN: PaymentWebViewScreen

- Full-screen WebView loading the Paystack `payment_url`
- Loading spinner overlay while page loads
- Intercept URL changes: when URL starts with `fooda://payment/callback`, extract `?reference=` and navigate to PaymentCallbackScreen
- Back button in header to cancel (show confirmation dialog: "Are you sure you want to cancel payment?")

---

### SCREEN: PaymentCallbackScreen

Four states with matching UI:

| State | Icon | Title | Colour | Actions |
|-------|------|-------|--------|---------|
| `checking` | ⏳ animated | Verifying payment… | `#8b5cf6` | Animated dots |
| `success` | 🎉 | Payment Successful! | `#16a34a` | "Track My Order" + "Continue Shopping" |
| `pending` | ⏰ | Payment Processing | `#f59e0b` | "View My Orders" + "Back to Restaurants" |
| `failed` | ❌ | Payment Failed | `#dc2626` | "Try Again" + "View My Orders" |

**Polling logic:**
```typescript
const reference = route.params.reference;
let attempts = 0;
const poll = async () => {
  const { data } = await supabase
    .from('orders')
    .select('id, payment_status')
    .eq('payment_reference', reference)
    .single();
  if (data?.payment_status === 'completed') { setOrderId(data.id); setState('success'); return; }
  if (data?.payment_status === 'failed') { setState('failed'); return; }
  if (++attempts < 8) setTimeout(poll, 2000);
  else setState('pending');
};
poll();
```

---

### SCREEN: OrderHistoryScreen

**Sections:**
1. Active Orders (status: pending/confirmed/preparing/ready_for_pickup/picked_up) — live orange border
2. Past Orders (delivered/cancelled)

**OrderCard:**
- Restaurant name + logo
- Order number + date
- Status badge (colour-coded)
- Item count + total amount in `#ff6b35`
- Buttons:
  - Active: "📡 Track Order" (outline orange)
  - Past: "View Details" + "⭐ Leave Review" (if delivered and not yet reviewed)
  - Already reviewed: "✅ Reviewed" text

**Data Query:**
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

---

### SCREEN: OrderTrackingScreen

**Layout:**
1. **Header:** Order #ORD-XXXX + date + status badge
2. **Live notice banner:** "📡 This page updates automatically" (orange banner; hidden once delivered/cancelled)
3. **Progress Timeline:**
   - Vertical stepper
   - Steps: Order Placed → Confirmed → Preparing → Ready → On the way → Delivered
   - Done step: green filled circle with ✓
   - Active step: orange ring with step icon
   - Pending step: grey circle with icon
   - If cancelled: show cancelled step in red at the appropriate position
4. **Restaurant Info:** Name + phone (tappable)
5. **Delivery Address:** Snapshot from order
6. **Items Ordered:** List + subtotal/tax/delivery/total
7. **Payment Status:** "Completed ✓" / "Pending" / "Failed"

**Realtime subscription:**
```typescript
supabase.channel(`order-${orderId}`)
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
    () => refetchOrder()
  )
  .subscribe();
```

---

### SCREEN: NotificationsScreen

**Header:** "Notifications" title + unread count badge + "Mark all read" button

**Two sections:**
1. **New** (unread): cards with `#fff7ed` background and `#fed7aa` border + orange dot top-right
2. **Earlier** (read): cards with white background

**NotificationCard:**
- Icon circle (notification type colour at 15% opacity)
- Title (weight 700 if unread, 600 if read)
- Message text (2 lines)
- Time ago ("2m ago", "3h ago", "Yesterday")
- "View order →" link in orange if `order_id` present
- Tap → mark as read + navigate to order tracking if `order_id` exists

**Type config:**
```typescript
const TYPE_CONFIG = {
  order_created:       { icon: '🛍️', color: '#3b82f6' },
  order_status_update: { icon: '📦', color: '#8b5cf6' },
  payment_received:    { icon: '💳', color: '#16a34a' },
  delivery_assigned:   { icon: '🛵', color: '#f59e0b' },
  custom:              { icon: '📢', color: '#ff6b35' },
  system:              { icon: 'ℹ️',  color: '#6b7280' },
};
```

**Realtime — new notifications:**
```typescript
supabase.channel(`notifications-${userId}`)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
    (payload) => {
      setNotifications(prev => [payload.new, ...prev]);
      setBadgeCount(prev => prev + 1);
    }
  )
  .subscribe();
```

---

### SCREEN: ProfileScreen

**Layout:**
1. **Avatar + name row:** Gradient avatar (initials), full name, email, "Edit" button
2. **Stats Row (3 cards):** 📦 Total Orders | 💳 Total Spent | ⭐ Reviews Given
3. **Profile Info:** Full Name, Email (read-only), Phone — "Edit Profile" opens edit mode
4. **Saved Addresses:** List of address cards with "Set Default" + "Delete" actions; "Add Address" button
5. **Quick Links:** My Orders → Notifications → Browse Restaurants → Help/Support
6. **Sign Out** button (red border, white background)

**Stats query:**
```typescript
const [{ data: userData }, { data: addresses }, { data: orders }, { count: reviewCount }] = await Promise.all([
  supabase.from('users').select('id, full_name, email, phone, avatar_url').eq('id', userId).single(),
  supabase.from('user_addresses').select('*').eq('user_id', userId).order('is_default', { ascending: false }),
  supabase.from('orders').select('total_amount, payment_status').eq('customer_id', userId),
  supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('customer_id', userId),
]);
const totalSpent = orders.filter(o => o.payment_status === 'completed').reduce((s, o) => s + Number(o.total_amount), 0);
```

---

## PART 7: VENDOR SCREENS

### SCREEN: VendorOrdersScreen

**Tab filter pills:** All | Pending | Active | Ready | Done | Cancelled

**OrderCard (vendor view):**
- Order number + time elapsed since order (e.g. "12 min ago")
- Customer name + phone
- Items summary
- Total in orange
- Status badge
- Action buttons: "Confirm" | "Mark Preparing" | "Mark Ready" | "Mark Picked Up" (contextual next status)

**Realtime:**
```typescript
supabase.channel(`vendor-orders-${vendorId}`)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `vendor_id=eq.${vendorId}` },
    (payload) => addOrderToTop(payload.new)
  )
  .subscribe();
```

**Update order status:**
```typescript
await supabase.from('orders').update({ status: nextStatus }).eq('id', orderId);
```

---

### SCREEN: VendorMenuScreen

**Header:** Search bar + "Add Item" button (orange)

**Category filter pills** (horizontal scroll)

**MenuItem cards in grid (2 columns):**
- Item image (square, rounded)
- Name + price
- Category badge
- Available toggle switch (green/grey)
- Edit (pencil) + Delete (trash) icon buttons

**Add/Edit Item Modal (BottomSheet or full-screen modal):**
- Item Name*
- Description
- Price (NGN)*
- Category dropdown (fetched from vendor's categories)
- Upload Image: "📷 Take Photo" + "📁 Choose from Gallery" + image preview
- Prep Time (minutes)
- Is Vegetarian / Is Vegan toggles
- Is Available toggle
- "Save Item" button

**Image Upload:**
```typescript
const uploadMenuImage = async (uri: string): Promise<string> => {
  const response = await fetch(uri);
  const blob = await response.blob();
  const path = `${vendorId}/${Date.now()}.jpg`;
  await supabase.storage.from('menu-images').upload(path, blob, { upsert: true });
  const { data } = supabase.storage.from('menu-images').getPublicUrl(path);
  return data.publicUrl;
};
```

---

### SCREEN: VendorAnalyticsScreen

**Time filter:** Today | This Week | This Month | All Time

**Metrics cards row:**
- 📦 Total Orders
- ₦ Total Revenue
- 📊 Average Order Value
- ⭐ Average Rating

**Top 5 Selling Items list** (name + qty sold + revenue)

**Recent Orders list** (last 5, quick view)

---

### SCREEN: VendorSettingsScreen

**Sections:**
1. **Restaurant Info:** Name, Description, Phone, Email — editable inline
2. **Address:** Street, Area, City, State
3. **Business Hours:** Toggle + open/close time picker for each day (Mon–Sun)
4. **Images:** Logo upload (circle preview) + Cover Photo upload (rectangle preview)
5. **Account:** Email (read-only), Change Password, Sign Out

**Logo/Cover Upload — same pattern as menu image upload but to `vendor-images` bucket.**

---

## PART 8: ADMIN SCREENS

### SCREEN: AdminOverviewScreen

**Stats cards (2×2 grid):**
- Total Revenue (all time, completed orders)
- Total Orders
- Active Vendors
- Registered Users

**Recent Orders table** (last 10, all vendors)

**Recent Vendors list** (last 5 to join)

---

### SCREEN: AdminVendorsScreen

- Search bar
- List of all vendors (active and inactive)
- Each row: logo, name, email, status badge (Active/Inactive), created_at
- Actions: Activate / Deactivate toggle | Edit | Delete
- "Add Vendor" button (create vendor account manually)

**Data:**
```typescript
const { data } = await supabase
  .from('vendors')
  .select('id, name, email, phone, logo_url, is_active, created_at, owner:users(full_name, email)')
  .order('created_at', { ascending: false });
```

---

### SCREEN: AdminOrdersScreen

- Filter pills: All | Pending | Active | Delivered | Cancelled
- All orders across all vendors
- Each row: order number, vendor name, customer name, total, status, date
- Tap to view full order details + update status

---

### SCREEN: AdminUsersScreen

- Search + filter by role
- Each row: avatar initials, full name, email, role badge, joined date
- Actions: Change role (dropdown) | Deactivate | Delete

**Change role:**
```typescript
await supabase.from('users').update({ role: newRole }).eq('id', userId);
```

---

### SCREEN: AdminPlatformSettingsScreen

- List of editable platform settings
- Inline edit for each value (text input with type-appropriate keyboard)
- "Save" button per row
- Settings: Delivery Fee, Tax Rate, Commission Rate, Min Order Amount, Max Delivery Distance, Support Email, Support Phone

---

## PART 9: CART CONTEXT

```typescript
// Persist with AsyncStorage key: 'fooda_cart'
interface CartItem {
  menuItemId: string;
  name: string;
  price: number;      // unit price NGN
  quantity: number;
  imageUrl?: string;
  addons?: { id: string; name: string; price: number }[];
}
interface CartState {
  vendorId: string | null;
  vendorName: string | null;
  items: CartItem[];
}
```

**Rules:**
- Single vendor per cart
- Adding from a different vendor → show Alert: "Your cart contains items from [Old Restaurant]. Clear cart and switch to [New Restaurant]?" → Yes: clearCart + addItem | No: do nothing
- `itemCount = items.reduce((s, i) => s + i.quantity, 0)`
- `subtotal = items.reduce((s, i) => s + (i.price + (i.addons?.reduce((a, x) => a + x.price, 0) ?? 0)) * i.quantity, 0)`

---

## PART 10: REALTIME SUBSCRIPTIONS (Summary)

| Channel | Table | Event | Who | Action |
|---------|-------|-------|-----|--------|
| `order-tracking-{orderId}` | orders | UPDATE | Customer | Refresh order status UI |
| `vendor-orders-{vendorId}` | orders | INSERT | Vendor | Add new order to top |
| `vendor-orders-{vendorId}` | orders | UPDATE | Vendor | Refresh specific order |
| `notifications-{userId}` | notifications | INSERT | Any user | Increment badge, show local notif |

---

## PART 11: EDGE FUNCTIONS

### `create-order`
**Invoke:** `supabase.functions.invoke('create-order', { body: {...} })`

**Request:**
```typescript
{
  vendor_id: string;
  items: { menu_item_id: string; quantity: number }[];
  delivery_address: { street: string; area?: string; city: string };
  notes?: string;
}
```

**Success Response:**
```typescript
{ order: { id: string; order_number: string; total_amount: number; status: 'pending' } }
```

**Error Response:**
```typescript
{ error: string }
```

### `process-payment`
**Invoke:** `supabase.functions.invoke('process-payment', { body: {...} })`

**Request:**
```typescript
{
  order_id: string;
  amount: number;         // total NGN
  email: string;
  callback_url: string;   // 'fooda://payment/callback'
}
```

**Success Response:**
```typescript
{ payment_url: string; reference: string }
```

---

## PART 12: DEEP LINK CONFIGURATION

Scheme: `fooda://`

**Expo (app.json):**
```json
{
  "expo": {
    "scheme": "fooda",
    "ios": { "bundleIdentifier": "com.fooda.app" },
    "android": { "package": "com.fooda.app" }
  }
}
```

**Handle in app:**
```typescript
import * as Linking from 'expo-linking';
const url = await Linking.getInitialURL();
// Subscribe to incoming links:
Linking.addEventListener('url', ({ url }) => {
  if (url.includes('payment/callback')) {
    const { queryParams } = Linking.parse(url);
    const reference = queryParams?.reference ?? queryParams?.trxref;
    navigation.navigate('PaymentCallback', { reference });
  }
});
```

---

## PART 13: STORAGE BUCKETS

| Bucket | Usage | URL Pattern |
|--------|-------|-------------|
| `menu-images` | Menu item photos | `https://jxkmsdwqaxcqrqtmwlln.supabase.co/storage/v1/object/public/menu-images/{path}` |
| `vendor-images` | Logo + cover photos | `https://jxkmsdwqaxcqrqtmwlln.supabase.co/storage/v1/object/public/vendor-images/{path}` |

Both buckets are **public read**. Any authenticated user can upload to these buckets (RLS allows owner uploads).

---

## PART 14: BRANDING & DESIGN SYSTEM

### Colours (use as a constants file: `theme/colors.ts`)

```typescript
export const colors = {
  // Brand
  primary:          '#ff6b35',
  primaryDark:      '#e55a2b',
  primaryLight:     '#fff7ed',
  primaryBorder:    '#fed7aa',

  // Backgrounds
  background:       '#f8f9fa',
  surface:          '#ffffff',
  gradientStart:    '#ff6b35',
  gradientMid:      '#f7931e',
  gradientEnd:      '#1a1a2e',

  // Text
  textPrimary:      '#1a1a1a',
  textSecondary:    '#444444',
  textTertiary:     '#666666',
  textMuted:        '#888888',
  textPlaceholder:  'rgba(180, 180, 180, 0.9)',

  // Borders & Dividers
  border:           '#e5e7eb',
  divider:          '#f0f0f0',
  surfaceBorder:    '#f9f9f9',

  // Semantic States
  success:          '#16a34a',
  successLight:     '#dcfce7',
  info:             '#3b82f6',
  infoLight:        '#dbeafe',
  warning:          '#f59e0b',
  warningLight:     '#fef3c7',
  error:            '#dc2626',
  errorLight:       '#fee2e2',
  purple:           '#8b5cf6',
  purpleLight:      '#ede9fe',
  cyan:             '#06b6d4',
  cyanLight:        '#cffafe',

  // Status → Order
  statusPending:       '#f59e0b',
  statusConfirmed:     '#3b82f6',
  statusPreparing:     '#8b5cf6',
  statusReady:         '#06b6d4',
  statusPickedUp:      '#ff6b35',
  statusDelivered:     '#16a34a',
  statusCancelled:     '#dc2626',
};
```

### Typography (use as `theme/typography.ts`)

```typescript
export const typography = {
  fontFamily:    'Inter',   // fallback: System font
  weights: {
    regular:   '400',
    medium:    '500',
    semibold:  '600',
    bold:      '700',
    extrabold: '800',
    black:     '900',
  },
  sizes: {
    micro:    10,
    caption:  12,
    small:    13,
    body:     14,
    bodyLg:   15,
    title:    17,
    heading:  20,
    display:  24,
    hero:     32,
  },
};
```

### Spacing (use as `theme/spacing.ts`)

```typescript
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};
```

### Border Radius (use as `theme/radius.ts`)

```typescript
export const radius = {
  sm:     8,
  md:     10,
  lg:     12,
  xl:     14,
  card:   16,
  modal:  20,
  pill:   30,
  circle: 9999,
};
```

### Shadows (React Native)

```typescript
export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,   // Android
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.20,
    shadowRadius: 30,
    elevation: 10,
  },
  cta: {
    shadowColor: '#ff6b35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 12,
    elevation: 6,
  },
};
```

### Logo / App Icon

- Symbol: Fork and knife (🍴)
- Color: `#ff6b35` on transparent or white background
- Wordmark: "Fooda" font weight 900
- Do not add background shapes to the symbol alone (favicon/icon usage)

### Currency Formatting

```typescript
export const formatPrice = (amount: number): string =>
  '₦' + Math.round(amount).toLocaleString('en-NG');
// Output: ₦2,500  ₦14,750  ₦500
```

### Auth Page Gradient

```
LinearGradient: ['#ff6b35', '#f7931e', '#1a1a2e'] start (top) to end (bottom)
```

---

## PART 15: BUSINESS RULES & VALIDATION

| Rule | Detail |
|------|--------|
| Password minimum | 6 characters |
| Min order amount | ₦1,000 (from `platform_settings`) |
| Single-vendor cart | Adding from different vendor clears cart (with confirmation alert) |
| Review eligibility | Customer must have a `delivered` order from that vendor |
| Duplicate review | Error code `23505` → "You have already reviewed this order" |
| Public reviews | Only `is_verified = true` reviews are shown |
| Tax rate | 7.5% of subtotal (from `platform_settings.tax_rate`) |
| Delivery fee | ₦500 flat (from `platform_settings.delivery_fee`) |
| Price snapshots | Order items store price at time of order — menu changes don't affect past orders |
| Vendor visibility | Only `is_active = true` vendors shown to customers |
| Role source of truth | Always `public.users.role` — never `user_metadata.role` |

---

## PART 16: ERROR HANDLING STANDARDS

Every Supabase call must have error handling. Use this pattern:

```typescript
// Table queries
const { data, error } = await supabase.from(...).select(...);
if (error) {
  if (error.code === '42501') toast.error('You do not have permission to do this.');
  else if (error.code === 'PGRST301') { /* JWT expired — sign out */ }
  else toast.error(error.message ?? 'Something went wrong. Please try again.');
  return;
}

// Edge functions
const { data, error: fnErr } = await supabase.functions.invoke('...', { body });
if (fnErr) throw new Error(`Request failed: ${fnErr.message}`);
if (data?.error) throw new Error(data.error);
```

**Standard error messages to catch:**
```
'Invalid login credentials'         → "Incorrect email or password."
'Email not confirmed'               → "Please confirm your email before signing in."
'User already registered'           → "An account with this email already exists."
'Password should be at least 6...'  → "Password must be at least 6 characters."
'23505' (duplicate review)          → "You have already reviewed this order."
'42501' (RLS denied)                → "You don't have permission to do this."
```

---

## PART 17: PERFORMANCE STANDARDS

- Use `@shopify/flash-list` instead of FlatList for all lists with more than 10 items
- Lazy load images with a proper image library (expo-image or react-native-fast-image)
- Always show skeleton loaders while data is loading — never a blank screen
- Paginate long lists: use `.range(from, to)` on Supabase queries (page size: 20)
- Memoize callbacks with `useCallback`; heavy components with `React.memo`
- Cart state persisted to AsyncStorage on every change; hydrated from AsyncStorage on app start
- Platform settings fetched once per session and cached in a global context
- Realtime channels must be unsubscribed on component unmount (`supabase.removeChannel(channel)`)
- Optimistic UI for cart operations (add/remove/update quantity should feel instant)

---

## PART 18: NOTIFICATION BADGE

The notification bell in the customer bottom tab bar and restaurant list header must:
1. Show a red badge with the unread count
2. Update in real time via a Realtime subscription
3. Clear to 0 when the user visits the NotificationsScreen
4. Re-fetch count on app foreground (AppState 'active')

```typescript
// Global unread count — store in AuthContext or a NotificationsContext
const fetchUnreadCount = async () => {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  setUnreadCount(count ?? 0);
};
```

---

## PART 19: PRODUCTION CHECKLIST

Before submission, ensure:

- [ ] No hardcoded secrets or API keys in JSX/TSX (use constants from a single file)
- [ ] All screens have loading states (skeleton or spinner)
- [ ] All screens have empty states (friendly illustration + message)
- [ ] All screens have error states (retry button)
- [ ] All destructive actions have confirmation alerts (delete item, clear cart, sign out)
- [ ] All forms validate required fields before submission
- [ ] Back navigation works on every screen
- [ ] Deep link `fooda://payment/callback` is handled on both platforms
- [ ] All realtime channels are unsubscribed on unmount
- [ ] AsyncStorage cart is cleared after successful order
- [ ] Image uploads show a progress indicator
- [ ] Currency is always formatted as `₦X,XXX` (no decimals)
- [ ] Status badges use the correct colour for each status
- [ ] Vendor cannot see customer screens and vice versa
- [ ] Admin can access all data

---

## PART 20: FOLDER STRUCTURE (Recommended)

```
src/
├── components/
│   ├── common/        (Button, Input, Card, Badge, Skeleton, Avatar, EmptyState)
│   ├── customer/      (RestaurantCard, MenuItemCard, OrderCard, NotifCard)
│   ├── vendor/        (VendorOrderCard, MenuItemEditorModal)
│   └── admin/         (UserRow, VendorRow)
├── screens/
│   ├── auth/
│   ├── customer/
│   ├── vendor/
│   └── admin/
├── navigation/
│   ├── RootNavigator.tsx
│   ├── CustomerNavigator.tsx
│   ├── VendorNavigator.tsx
│   └── AdminNavigator.tsx
├── context/
│   ├── AuthContext.tsx
│   ├── CartContext.tsx
│   └── NotificationsContext.tsx
├── lib/
│   └── supabase.ts
├── theme/
│   ├── colors.ts
│   ├── typography.ts
│   ├── spacing.ts
│   ├── radius.ts
│   └── shadows.ts
├── hooks/
│   ├── useAuth.ts
│   ├── useCart.ts
│   └── usePlatformSettings.ts
└── utils/
    ├── formatPrice.ts
    ├── formatDate.ts
    ├── orderStatus.ts
    └── businessHours.ts
```

---

## PART 21: FINAL INSTRUCTIONS TO THE AGENT

1. **Start with the project setup** — Expo managed workflow, TypeScript, all required packages.
2. **Build the theme constants first** — colours, typography, spacing, shadows. Every styled component must use these tokens; no hardcoded hex values outside theme files.
3. **Build AuthContext and CartContext** before any screens.
4. **Build the navigation structure** (RootNavigator + three role stacks) before any screen content.
5. **Build shared components** (Button, Input, Card, Badge, Skeleton, EmptyState, Avatar) that will be reused across all screens.
6. **Build screens in this order:**
   - Auth screens (Login, Register Customer, Register Vendor)
   - Customer screens (RestaurantList → RestaurantDetail → Checkout → PaymentCallback → OrderTracking → OrderHistory → Notifications → Profile)
   - Vendor screens (Orders → Menu → Analytics → Settings)
   - Admin screens (Overview → Vendors → Orders → Users → Settings)
7. **Wire up Realtime** on OrderTracking, VendorOrders, and Notifications screens.
8. **Add deep link handling** for Paystack callback.
9. **Final pass:** Loading states, empty states, error states on every screen.
10. **Do not hallucinate API endpoints or table names.** Everything is documented above. If something is unclear, use exactly what is specified here.

The goal is a polished, production-grade app that a Nigerian user would be proud to install and use daily. Make it beautiful, fast, and reliable.

---

*Reference: https://foodaweb.vercel.app/ — Supabase Project: https://jxkmsdwqaxcqrqtmwlln.supabase.co*
