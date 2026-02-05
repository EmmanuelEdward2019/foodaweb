# Fooda Multi-Vendor Food Delivery Platform - Complete API Documentation

## Overview
This document provides comprehensive API documentation for the Fooda platform, including endpoints for web apps (Admin & Vendor dashboards) and mobile apps (User & Delivery Rider).

**Version**: 1.0.0  
**Base URL**: `https://dukvrgupgtymxxbqpctq.supabase.co`  
**API Prefix**: `/rest/v1`

## Technology Stack
- **Backend**: Supabase (PostgreSQL + Auto-generated REST API + Real-time subscriptions)
- **Database**: PostgreSQL (managed by Supabase)
- **Authentication**: Supabase Auth (JWT-based)
- **Real-time**: Supabase Realtime (WebSocket)
- **Storage**: Supabase Storage (for images/files)
- **Frontend Web**: React + TypeScript + Vite
- **Frontend Mobile**: Flutter (Future development)

**Note**: This project uses Supabase as a complete Backend-as-a-Service (BaaS) solution. No custom Node.js/Express server is required.

---

## Table of Contents
1. [Authentication & Authorization](#1-authentication--authorization)
2. [User App APIs](#2-user-app-apis)
3. [Vendor APIs](#3-vendor-apis)
4. [Admin APIs](#4-admin-apis)
5. [Delivery Rider APIs](#5-delivery-rider-apis)
6. [Order Lifecycle](#6-order-lifecycle)
7. [Payment Integration](#7-payment-integration)
8. [Notifications](#8-notifications)
9. [Error Handling](#9-error-handling)
10. [API Versioning](#10-api-versioning)

---

## Configuration

### Supabase Credentials
```json
{
  "url": "https://dukvrgupgtymxxbqpctq.supabase.co",
  "anonKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1a3ZyZ3VwZ3R5bXh4YnFwY3RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NjY1MTQsImV4cCI6MjA4MDQ0MjUxNH0._WUj92bMmPakzdA7dltor8ADGUhOlHExSKB4DRvugcg"
}
```

### Required Headers
```http
Content-Type: application/json
apikey: {SUPABASE_ANON_KEY}
Authorization: Bearer {JWT_TOKEN}
```

---

## 1. Authentication & Authorization

### 1.1 User Registration (Customer)

**Endpoint**: `POST /auth/v1/signup`

**Description**: Register a new customer account

**Request Headers**:
```http
Content-Type: application/json
apikey: {SUPABASE_ANON_KEY}
```

**Request Body**:
```json
{
  "email": "customer@example.com",
  "password": "SecurePass123!",
  "data": {
    "role": "customer",
    "full_name": "John Doe",
    "phone": "+234 801 234 5678"
  }
}
```

**Response** (201 Created):
```json
{
  "user": {
    "id": "uuid-here",
    "email": "customer@example.com",
    "role": "authenticated",
    "user_metadata": {
      "role": "customer",
      "full_name": "John Doe"
    }
  },
  "session": {
    "access_token": "jwt-token-here",
    "refresh_token": "refresh-token-here",
    "expires_in": 3600
  }
}
```

**Error Response** (400 Bad Request):
```json
{
  "error": "User already registered",
  "message": "Email already exists"
}
```

---

### 1.2 Vendor Registration

**Endpoint**: `POST /auth/v1/signup`

**Request Body**:
```json
{
  "email": "vendor@restaurant.com",
  "password": "SecurePass123!",
  "data": {
    "role": "vendor",
    "business_name": "Pizza Palace",
    "full_name": "Restaurant Owner",
    "phone": "+234 801 234 5678"
  }
}
```

**Response**: Same as User Registration

---

### 1.3 Login

**Endpoint**: `POST /auth/v1/token?grant_type=password`

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response** (200 OK):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "refresh-token-here",
  "user": {
    "id": "uuid-here",
    "email": "user@example.com",
    "user_metadata": {
      "role": "customer",
      "full_name": "John Doe"
    }
  }
}
```

---

### 1.4 Logout

**Endpoint**: `POST /auth/v1/logout`

**Request Headers**:
```http
Authorization: Bearer {JWT_TOKEN}
apikey: {SUPABASE_ANON_KEY}
```

**Response** (204 No Content)

---

### 1.5 Refresh Token

**Endpoint**: `POST /auth/v1/token?grant_type=refresh_token`

**Request Body**:
```json
{
  "refresh_token": "refresh-token-here"
}
```

**Response**: Same as Login

---

### 1.6 Get Current User

**Endpoint**: `GET /auth/v1/user`

**Request Headers**:
```http
Authorization: Bearer {JWT_TOKEN}
apikey: {SUPABASE_ANON_KEY}
```

**Response** (200 OK):
```json
{
  "id": "uuid-here",
  "email": "user@example.com",
  "user_metadata": {
    "role": "customer",
    "full_name": "John Doe"
  },
  "created_at": "2024-01-01T00:00:00Z"
}
```

---

### Role-Based Access Control

| Role | Permissions |
|------|-------------|
| **customer** | Browse vendors, place orders, track orders, manage profile |
| **vendor** | Manage menu, view orders, update order status, manage profile |
| **rider** | View assigned deliveries, update delivery status, track location |
| **admin** | Full access to all resources, manage users, vendors, orders |

---

## 2. User App APIs

### 2.1 Browse Vendors

**Endpoint**: `GET /rest/v1/vendors`

**Query Parameters**:
- `is_active=eq.true` - Filter active vendors
- `order=name.asc` - Sort by name
- `limit=20` - Pagination limit
- `offset=0` - Pagination offset

**Request Headers**:
```http
apikey: {SUPABASE_ANON_KEY}
```

**Response** (200 OK):
```json
[
  {
    "id": "vendor-uuid",
    "name": "Pizza Palace",
    "email": "pizza@palace.com",
    "phone": "+234 801 234 5678",
    "description": "Best pizza in town",
    "image_url": "https://example.com/pizza.jpg",
    "is_active": true,
    "rating": 4.5,
    "delivery_time": "30-45 mins",
    "minimum_order": 1000,
    "delivery_fee": 500,
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

---

### 2.2 Search Vendors

**Endpoint**: `GET /rest/v1/vendors`

**Query Parameters**:
- `name=ilike.*pizza*` - Search by name
- `is_active=eq.true`

**Response**: Same as Browse Vendors

---

### 2.3 Get Vendor Details

**Endpoint**: `GET /rest/v1/vendors?id=eq.{vendor_id}`

**Response** (200 OK):
```json
{
  "id": "vendor-uuid",
  "name": "Pizza Palace",
  "email": "pizza@palace.com",
  "phone": "+234 801 234 5678",
  "description": "Best pizza in town",
  "image_url": "https://example.com/pizza.jpg",
  "is_active": true,
  "rating": 4.5,
  "delivery_time": "30-45 mins",
  "minimum_order": 1000,
  "delivery_fee": 500,
  "address": "123 Food Street, Lagos",
  "latitude": 6.5244,
  "longitude": 3.3792,
  "opening_hours": {
    "monday": "09:00-22:00",
    "tuesday": "09:00-22:00"
  },
  "created_at": "2024-01-01T00:00:00Z"
}
```

---

### 2.4 Get Vendor Menu

**Endpoint**: `GET /rest/v1/menu_items`

**Query Parameters**:
- `vendor_id=eq.{vendor_id}`
- `is_available=eq.true`
- `select=*,menu_categories(*),menu_item_addons(*)`

**Response** (200 OK):
```json
[
  {
    "id": "item-uuid",
    "vendor_id": "vendor-uuid",
    "category_id": "category-uuid",
    "name": "Margherita Pizza",
    "description": "Fresh mozzarella and basil",
    "price": 2500,
    "image_url": "https://example.com/margherita.jpg",
    "is_available": true,
    "is_vegetarian": true,
    "is_vegan": false,
    "prep_time": 20,
    "sort_order": 1,
    "menu_categories": {
      "id": "category-uuid",
      "name": "Pizzas",
      "description": "Our signature pizzas"
    },
    "menu_item_addons": [
      {
        "id": "addon-uuid",
        "name": "Extra Cheese",
        "price": 300,
        "is_available": true
      },
      {
        "id": "addon-uuid-2",
        "name": "Pepperoni",
        "price": 500,
        "is_available": true
      }
    ]
  }
]
```

---

### 2.5 Get Menu Categories

**Endpoint**: `GET /rest/v1/menu_categories`

**Query Parameters**:
- `vendor_id=eq.{vendor_id}`
- `is_active=eq.true`
- `order=sort_order.asc`

**Response** (200 OK):
```json
[
  {
    "id": "category-uuid",
    "vendor_id": "vendor-uuid",
    "name": "Pizzas",
    "description": "Our signature pizzas",
    "is_active": true,
    "sort_order": 1,
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

---

### 2.6 Create Order

**Endpoint**: `POST /rest/v1/orders`

**Request Headers**:
```http
Authorization: Bearer {JWT_TOKEN}
apikey: {SUPABASE_ANON_KEY}
Content-Type: application/json
Prefer: return=representation
```

**Request Body**:
```json
{
  "customer_id": "user-uuid",
  "vendor_id": "vendor-uuid",
  "order_number": "ORD-1704067200000",
  "status": "pending",
  "subtotal": 5000,
  "tax_amount": 375,
  "delivery_fee": 500,
  "total_amount": 5875,
  "payment_method": "card",
  "payment_status": "pending",
  "delivery_address": {
    "street": "123 Main St",
    "city": "Lagos",
    "state": "Lagos",
    "postal_code": "100001",
    "country": "Nigeria"
  },
  "delivery_latitude": 6.5244,
  "delivery_longitude": 3.3792,
  "notes": "Please ring the bell"
}
```

**Response** (201 Created):
```json
{
  "id": "order-uuid",
  "customer_id": "user-uuid",
  "vendor_id": "vendor-uuid",
  "order_number": "ORD-1704067200000",
  "status": "pending",
  "subtotal": 5000,
  "tax_amount": 375,
  "delivery_fee": 500,
  "total_amount": 5875,
  "payment_method": "card",
  "payment_status": "pending",
  "delivery_address": {...},
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

---

### 2.7 Create Order Items

**Endpoint**: `POST /rest/v1/order_items`

**Request Body**:
```json
[
  {
    "order_id": "order-uuid",
    "menu_item_id": "item-uuid",
    "quantity": 2,
    "price_per_unit": 2500,
    "total_price": 5000,
    "special_instructions": "Extra spicy",
    "addons": [
      {
        "addon_id": "addon-uuid",
        "name": "Extra Cheese",
        "price": 300
      }
    ]
  }
]
```

**Response** (201 Created):
```json
[
  {
    "id": "order-item-uuid",
    "order_id": "order-uuid",
    "menu_item_id": "item-uuid",
    "quantity": 2,
    "price_per_unit": 2500,
    "total_price": 5000,
    "special_instructions": "Extra spicy",
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

---

### 2.8 Get Customer Orders

**Endpoint**: `GET /rest/v1/orders`

**Query Parameters**:
- `customer_id=eq.{user_id}`
- `select=*,order_items(*,menu_items(*)),vendors(*)`
- `order=created_at.desc`

**Request Headers**:
```http
Authorization: Bearer {JWT_TOKEN}
apikey: {SUPABASE_ANON_KEY}
```

**Response** (200 OK):
```json
[
  {
    "id": "order-uuid",
    "order_number": "ORD-1704067200000",
    "status": "delivered",
    "total_amount": 5875,
    "payment_status": "completed",
    "created_at": "2024-01-01T00:00:00Z",
    "vendors": {
      "name": "Pizza Palace",
      "image_url": "https://example.com/pizza.jpg"
    },
    "order_items": [
      {
        "id": "item-uuid",
        "quantity": 2,
        "price_per_unit": 2500,
        "menu_items": {
          "name": "Margherita Pizza",
          "image_url": "https://example.com/margherita.jpg"
        }
      }
    ]
  }
]
```

---

### 2.9 Get Order Details

**Endpoint**: `GET /rest/v1/orders?id=eq.{order_id}`

**Query Parameters**:
- `select=*,order_items(*,menu_items(*)),vendors(*),delivery_riders(*)`

**Response** (200 OK):
```json
{
  "id": "order-uuid",
  "order_number": "ORD-1704067200000",
  "status": "in_transit",
  "subtotal": 5000,
  "tax_amount": 375,
  "delivery_fee": 500,
  "total_amount": 5875,
  "payment_method": "card",
  "payment_status": "completed",
  "delivery_address": {...},
  "delivery_latitude": 6.5244,
  "delivery_longitude": 3.3792,
  "notes": "Please ring the bell",
  "estimated_delivery_time": "2024-01-01T01:00:00Z",
  "actual_delivery_time": null,
  "created_at": "2024-01-01T00:00:00Z",
  "vendors": {
    "name": "Pizza Palace",
    "phone": "+234 801 234 5678"
  },
  "delivery_riders": {
    "full_name": "John Rider",
    "phone": "+234 801 111 2222",
    "current_latitude": 6.5200,
    "current_longitude": 3.3750
  },
  "order_items": [...]
}
```

---

### 2.10 Track Order (Real-time)

**Endpoint**: WebSocket Connection

**Subscribe to Order Updates**:
```typescript
const subscription = supabase
  .channel('order_tracking')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'orders',
      filter: `id=eq.${orderId}`
    },
    (payload) => {
      console.log('Order updated:', payload.new);
    }
  )
  .subscribe();
```

**Payload Example**:
```json
{
  "new": {
    "id": "order-uuid",
    "status": "preparing",
    "updated_at": "2024-01-01T00:15:00Z"
  },
  "old": {
    "status": "pending"
  }
}
```

---

### 2.11 Cancel Order

**Endpoint**: `PATCH /rest/v1/orders?id=eq.{order_id}`

**Request Body**:
```json
{
  "status": "cancelled",
  "cancellation_reason": "Changed my mind"
}
```

**Response** (200 OK):
```json
{
  "id": "order-uuid",
  "status": "cancelled",
  "cancellation_reason": "Changed my mind",
  "updated_at": "2024-01-01T00:30:00Z"
}
```

---

### 2.12 Rate Order

**Endpoint**: `POST /rest/v1/reviews`

**Request Body**:
```json
{
  "customer_id": "user-uuid",
  "vendor_id": "vendor-uuid",
  "order_id": "order-uuid",
  "rating": 5,
  "comment": "Excellent food and service!",
  "is_verified": true
}
```

**Response** (201 Created):
```json
{
  "id": "review-uuid",
  "customer_id": "user-uuid",
  "vendor_id": "vendor-uuid",
  "order_id": "order-uuid",
  "rating": 5,
  "comment": "Excellent food and service!",
  "is_verified": true,
  "created_at": "2024-01-01T00:00:00Z"
}
```

---

### 2.13 Get User Profile

**Endpoint**: `GET /rest/v1/users?id=eq.{user_id}`

**Response** (200 OK):
```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "role": "customer",
  "full_name": "John Doe",
  "phone": "+234 801 234 5678",
  "avatar_url": "https://example.com/avatar.jpg",
  "is_active": true,
  "created_at": "2024-01-01T00:00:00Z"
}
```

---

### 2.14 Update User Profile

**Endpoint**: `PATCH /rest/v1/users?id=eq.{user_id}`

**Request Body**:
```json
{
  "full_name": "John Updated Doe",
  "phone": "+234 801 999 8888",
  "avatar_url": "https://example.com/new-avatar.jpg"
}
```

**Response** (200 OK): Updated user object

---

### 2.15 Manage Addresses

#### Get Addresses
**Endpoint**: `GET /rest/v1/user_addresses?user_id=eq.{user_id}`

**Response**:
```json
[
  {
    "id": "address-uuid",
    "user_id": "user-uuid",
    "title": "Home",
    "address_line1": "123 Main St",
    "address_line2": "Apt 4B",
    "city": "Lagos",
    "state": "Lagos",
    "postal_code": "100001",
    "country": "Nigeria",
    "latitude": 6.5244,
    "longitude": 3.3792,
    "is_default": true,
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

#### Add Address
**Endpoint**: `POST /rest/v1/user_addresses`

**Request Body**:
```json
{
  "user_id": "user-uuid",
  "title": "Office",
  "address_line1": "456 Business Ave",
  "city": "Lagos",
  "state": "Lagos",
  "postal_code": "100002",
  "country": "Nigeria",
  "latitude": 6.5300,
  "longitude": 3.3800,
  "is_default": false
}
```

#### Update Address
**Endpoint**: `PATCH /rest/v1/user_addresses?id=eq.{address_id}`

#### Delete Address
**Endpoint**: `DELETE /rest/v1/user_addresses?id=eq.{address_id}`

---

## 3. Vendor APIs

### 3.1 Get Vendor Profile

**Endpoint**: `GET /rest/v1/vendors?owner_id=eq.{user_id}`

**Request Headers**:
```http
Authorization: Bearer {JWT_TOKEN}
apikey: {SUPABASE_ANON_KEY}
```

**Response** (200 OK):
```json
{
  "id": "vendor-uuid",
  "owner_id": "user-uuid",
  "name": "Pizza Palace",
  "email": "pizza@palace.com",
  "phone": "+234 801 234 5678",
  "description": "Best pizza in town",
  "image_url": "https://example.com/pizza.jpg",
  "is_active": true,
  "created_at": "2024-01-01T00:00:00Z"
}
```

---

### 3.2 Update Vendor Profile

**Endpoint**: `PATCH /rest/v1/vendors?id=eq.{vendor_id}`

**Request Body**:
```json
{
  "name": "Pizza Palace Updated",
  "phone": "+234 801 999 8888",
  "description": "The best pizza in Lagos",
  "image_url": "https://example.com/new-pizza.jpg"
}
```

**Response** (200 OK): Updated vendor object

---

### 3.3 Menu Management

#### Get Menu Items
**Endpoint**: `GET /rest/v1/menu_items?vendor_id=eq.{vendor_id}`

**Query Parameters**:
- `select=*,menu_categories(*),menu_item_addons(*)`
- `order=sort_order.asc`

#### Create Menu Item
**Endpoint**: `POST /rest/v1/menu_items`

**Request Body**:
```json
{
  "vendor_id": "vendor-uuid",
  "category_id": "category-uuid",
  "name": "Pepperoni Pizza",
  "description": "Classic pepperoni with cheese",
  "price": 3000,
  "image_url": "https://example.com/pepperoni.jpg",
  "is_available": true,
  "is_vegetarian": false,
  "is_vegan": false,
  "prep_time": 25,
  "sort_order": 2
}
```

**Response** (201 Created): Created menu item

#### Update Menu Item
**Endpoint**: `PATCH /rest/v1/menu_items?id=eq.{item_id}`

#### Delete Menu Item
**Endpoint**: `DELETE /rest/v1/menu_items?id=eq.{item_id}`

---

### 3.4 Menu Categories Management

#### Get Categories
**Endpoint**: `GET /rest/v1/menu_categories?vendor_id=eq.{vendor_id}`

#### Create Category
**Endpoint**: `POST /rest/v1/menu_categories`

**Request Body**:
```json
{
  "vendor_id": "vendor-uuid",
  "name": "Burgers",
  "description": "Juicy burgers",
  "is_active": true,
  "sort_order": 2
}
```

#### Update Category
**Endpoint**: `PATCH /rest/v1/menu_categories?id=eq.{category_id}`

#### Delete Category
**Endpoint**: `DELETE /rest/v1/menu_categories?id=eq.{category_id}`

---

### 3.5 Menu Item Add-ons Management

#### Get Add-ons
**Endpoint**: `GET /rest/v1/menu_item_addons?menu_item_id=eq.{item_id}`

#### Create Add-on
**Endpoint**: `POST /rest/v1/menu_item_addons`

**Request Body**:
```json
{
  "menu_item_id": "item-uuid",
  "name": "Extra Cheese",
  "price": 300,
  "is_available": true,
  "sort_order": 1
}
```

#### Update Add-on
**Endpoint**: `PATCH /rest/v1/menu_item_addons?id=eq.{addon_id}`

#### Delete Add-on
**Endpoint**: `DELETE /rest/v1/menu_item_addons?id=eq.{addon_id}`

---

### 3.6 Order Management

#### Get Vendor Orders
**Endpoint**: `GET /rest/v1/orders?vendor_id=eq.{vendor_id}`

**Query Parameters**:
- `select=*,order_items(*,menu_items(*)),users(full_name,phone)`
- `order=created_at.desc`
- `limit=50`

**Response** (200 OK):
```json
[
  {
    "id": "order-uuid",
    "order_number": "ORD-1704067200000",
    "status": "pending",
    "total_amount": 5875,
    "payment_status": "completed",
    "delivery_address": {...},
    "notes": "Please ring the bell",
    "created_at": "2024-01-01T00:00:00Z",
    "users": {
      "full_name": "John Doe",
      "phone": "+234 801 234 5678"
    },
    "order_items": [...]
  }
]
```

#### Update Order Status
**Endpoint**: `PATCH /rest/v1/orders?id=eq.{order_id}`

**Request Body**:
```json
{
  "status": "preparing"
}
```

**Allowed Status Transitions**:
- `pending` → `confirmed`
- `confirmed` → `preparing`
- `preparing` → `ready_for_pickup`
- `ready_for_pickup` → `picked_up`

---

### 3.7 Vendor Statistics

**Endpoint**: `GET /rest/v1/orders?vendor_id=eq.{vendor_id}`

**Query Parameters**:
- `select=status,total_amount,created_at`
- `created_at=gte.{start_date}`
- `created_at=lte.{end_date}`

**Calculate**:
- Total orders
- Total revenue
- Average order value
- Orders by status

---

## 4. Admin APIs

### 4.1 Dashboard Statistics

#### Get All Vendors
**Endpoint**: `GET /rest/v1/vendors`

**Query Parameters**:
- `select=*`
- `order=created_at.desc`
- `limit=100`

#### Get All Orders
**Endpoint**: `GET /rest/v1/orders`

**Query Parameters**:
- `select=*,vendors(name),users(full_name)`
- `order=created_at.desc`
- `limit=100`

#### Get All Users
**Endpoint**: `GET /rest/v1/users`

**Query Parameters**:
- `select=id,email,role,full_name,is_active,created_at`
- `order=created_at.desc`

---

### 4.2 Vendor Management

#### Create Vendor (via Auth)
**Endpoint**: `POST /auth/v1/signup`

**Request Body**:
```json
{
  "email": "newvendor@restaurant.com",
  "password": "SecurePass123!",
  "data": {
    "role": "vendor",
    "business_name": "New Restaurant",
    "full_name": "Owner Name"
  }
}
```

#### Update Vendor
**Endpoint**: `PATCH /rest/v1/vendors?id=eq.{vendor_id}`

#### Deactivate/Activate Vendor
**Endpoint**: `PATCH /rest/v1/vendors?id=eq.{vendor_id}`

**Request Body**:
```json
{
  "is_active": false
}
```

#### Delete Vendor
**Note**: Must delete in order:
1. Menu items
2. Menu categories
3. Vendor record
4. User record

---

### 4.3 User Management

#### Get All Users
**Endpoint**: `GET /rest/v1/users`

#### Update User
**Endpoint**: `PATCH /rest/v1/users?id=eq.{user_id}`

#### Deactivate User
**Endpoint**: `PATCH /rest/v1/users?id=eq.{user_id}`

**Request Body**:
```json
{
  "is_active": false
}
```

---

### 4.4 Platform Settings

#### Get Settings
**Endpoint**: `GET /rest/v1/platform_settings`

**Response**:
```json
[
  {
    "id": "setting-uuid",
    "setting_key": "delivery_fee",
    "setting_value": "500",
    "setting_type": "number",
    "description": "Default delivery fee in Naira"
  },
  {
    "id": "setting-uuid-2",
    "setting_key": "tax_rate",
    "setting_value": "0.075",
    "setting_type": "number",
    "description": "Tax rate (7.5%)"
  }
]
```

#### Update Setting
**Endpoint**: `PATCH /rest/v1/platform_settings?setting_key=eq.{key}`

**Request Body**:
```json
{
  "setting_value": "600"
}
```

---

## 5. Delivery Rider APIs

### 5.1 Rider Registration

**Endpoint**: `POST /auth/v1/signup`

**Request Body**:
```json
{
  "email": "rider@delivery.com",
  "password": "SecurePass123!",
  "data": {
    "role": "rider",
    "full_name": "John Rider",
    "phone": "+234 801 111 2222",
    "vehicle_type": "motorcycle",
    "vehicle_number": "ABC-123-XY"
  }
}
```

---

### 5.2 Get Assigned Deliveries

**Endpoint**: `GET /rest/v1/orders?rider_id=eq.{rider_id}`

**Query Parameters**:
- `select=*,vendors(name,phone,address),users(full_name,phone)`
- `status=in.("picked_up","in_transit")`
- `order=created_at.asc`

**Response** (200 OK):
```json
[
  {
    "id": "order-uuid",
    "order_number": "ORD-1704067200000",
    "status": "picked_up",
    "total_amount": 5875,
    "delivery_address": {...},
    "delivery_latitude": 6.5244,
    "delivery_longitude": 3.3792,
    "vendors": {
      "name": "Pizza Palace",
      "phone": "+234 801 234 5678",
      "address": "123 Food Street"
    },
    "users": {
      "full_name": "John Doe",
      "phone": "+234 801 234 5678"
    }
  }
]
```

---

### 5.3 Accept Delivery

**Endpoint**: `PATCH /rest/v1/orders?id=eq.{order_id}`

**Request Body**:
```json
{
  "rider_id": "rider-uuid",
  "status": "picked_up"
}
```

---

### 5.4 Update Delivery Status

**Endpoint**: `PATCH /rest/v1/orders?id=eq.{order_id}`

**Request Body**:
```json
{
  "status": "in_transit"
}
```

**Status Flow**:
- `ready_for_pickup` → `picked_up` (Rider picks up from vendor)
- `picked_up` → `in_transit` (Rider on the way)
- `in_transit` → `delivered` (Delivered to customer)

---

### 5.5 Update Rider Location (Real-time)

**Endpoint**: `PATCH /rest/v1/delivery_riders?id=eq.{rider_id}`

**Request Body**:
```json
{
  "current_latitude": 6.5200,
  "current_longitude": 3.3750,
  "last_location_update": "2024-01-01T00:45:00Z"
}
```

---

### 5.6 Complete Delivery

**Endpoint**: `PATCH /rest/v1/orders?id=eq.{order_id}`

**Request Body**:
```json
{
  "status": "delivered",
  "actual_delivery_time": "2024-01-01T01:00:00Z",
  "delivery_proof_url": "https://example.com/proof.jpg"
}
```

---

### 5.7 Get Rider Statistics

**Endpoint**: `GET /rest/v1/orders?rider_id=eq.{rider_id}`

**Query Parameters**:
- `select=status,total_amount,created_at,actual_delivery_time`
- `created_at=gte.{start_date}`

**Calculate**:
- Total deliveries
- Total earnings
- Average delivery time
- Success rate

---

## 6. Order Lifecycle

### Order Status Flow

```
pending → confirmed → preparing → ready_for_pickup → picked_up → in_transit → delivered
                                                                              ↓
                                                                          cancelled
```

### Status Descriptions

| Status | Description | Who Can Update |
|--------|-------------|----------------|
| `pending` | Order placed, awaiting vendor confirmation | System |
| `confirmed` | Vendor confirmed the order | Vendor |
| `preparing` | Food is being prepared | Vendor |
| `ready_for_pickup` | Food ready, waiting for rider | Vendor |
| `picked_up` | Rider picked up the order | Rider |
| `in_transit` | Order on the way to customer | Rider |
| `delivered` | Order delivered successfully | Rider |
| `cancelled` | Order cancelled | Customer/Vendor/Admin |

---

## 7. Payment Integration

### 7.1 Supported Payment Methods

- **Card** (Paystack)
- **Bank Transfer**
- **Cash on Delivery**
- **Wallet**

---

### 7.2 Initialize Payment (Paystack)

**Endpoint**: External Paystack API

**Request**:
```http
POST https://api.paystack.co/transaction/initialize
Authorization: Bearer {PAYSTACK_SECRET_KEY}
Content-Type: application/json
```

**Request Body**:
```json
{
  "email": "customer@example.com",
  "amount": 587500,
  "currency": "NGN",
  "reference": "ORD-1704067200000",
  "callback_url": "https://yourapp.com/payment/callback",
  "metadata": {
    "order_id": "order-uuid",
    "customer_id": "user-uuid"
  }
}
```

**Response**:
```json
{
  "status": true,
  "message": "Authorization URL created",
  "data": {
    "authorization_url": "https://checkout.paystack.com/xyz",
    "access_code": "xyz123",
    "reference": "ORD-1704067200000"
  }
}
```

---

### 7.3 Verify Payment

**Endpoint**: External Paystack API

**Request**:
```http
GET https://api.paystack.co/transaction/verify/{reference}
Authorization: Bearer {PAYSTACK_SECRET_KEY}
```

**Response**:
```json
{
  "status": true,
  "message": "Verification successful",
  "data": {
    "status": "success",
    "reference": "ORD-1704067200000",
    "amount": 587500,
    "currency": "NGN",
    "paid_at": "2024-01-01T00:05:00Z"
  }
}
```

---

### 7.4 Update Payment Status

**Endpoint**: `PATCH /rest/v1/orders?id=eq.{order_id}`

**Request Body**:
```json
{
  "payment_status": "completed",
  "payment_reference": "ORD-1704067200000"
}
```

---

### 7.5 Wallet Management

#### Get Wallet Balance
**Endpoint**: `GET /rest/v1/wallet_transactions?user_id=eq.{user_id}`

**Query Parameters**:
- `select=balance_after`
- `order=created_at.desc`
- `limit=1`

#### Add Funds
**Endpoint**: `POST /rest/v1/wallet_transactions`

**Request Body**:
```json
{
  "user_id": "user-uuid",
  "transaction_type": "credit",
  "amount": 5000,
  "description": "Wallet top-up",
  "payment_reference": "PAY-123456",
  "balance_after": 15000
}
```

#### Deduct Funds (for order)
**Endpoint**: `POST /rest/v1/wallet_transactions`

**Request Body**:
```json
{
  "user_id": "user-uuid",
  "transaction_type": "debit",
  "amount": 5875,
  "description": "Order payment",
  "order_id": "order-uuid",
  "balance_after": 9125
}
```

---

## 8. Notifications

### 8.1 Push Notifications (Firebase Cloud Messaging)

#### Send Order Notification

**Endpoint**: External FCM API

**Request**:
```http
POST https://fcm.googleapis.com/fcm/send
Authorization: key={FCM_SERVER_KEY}
Content-Type: application/json
```

**Request Body**:
```json
{
  "to": "{device_token}",
  "notification": {
    "title": "Order Confirmed",
    "body": "Your order #ORD-1704067200000 has been confirmed",
    "sound": "default",
    "badge": "1"
  },
  "data": {
    "order_id": "order-uuid",
    "type": "order_update",
    "status": "confirmed"
  }
}
```

---

### 8.2 In-App Notifications

**Endpoint**: `POST /rest/v1/notifications`

**Request Body**:
```json
{
  "user_id": "user-uuid",
  "title": "Order Confirmed",
  "message": "Your order #ORD-1704067200000 has been confirmed",
  "type": "order_update",
  "data": {
    "order_id": "order-uuid",
    "status": "confirmed"
  },
  "is_read": false
}
```

#### Get User Notifications
**Endpoint**: `GET /rest/v1/notifications?user_id=eq.{user_id}`

**Query Parameters**:
- `order=created_at.desc`
- `limit=50`

#### Mark as Read
**Endpoint**: `PATCH /rest/v1/notifications?id=eq.{notification_id}`

**Request Body**:
```json
{
  "is_read": true
}
```

---

### 8.3 Email Notifications

**Endpoint**: External Email Service (e.g., SendGrid)

**Order Confirmation Email**:
```json
{
  "to": "customer@example.com",
  "from": "noreply@fooda.com",
  "subject": "Order Confirmation - #ORD-1704067200000",
  "html": "<html>...</html>",
  "dynamic_template_data": {
    "order_number": "ORD-1704067200000",
    "total_amount": "₦5,875",
    "items": [...]
  }
}
```

---

### 8.4 SMS Notifications

**Endpoint**: External SMS Service (e.g., Twilio, Termii)

**Order Status Update**:
```json
{
  "to": "+2348012345678",
  "from": "Fooda",
  "message": "Your order #ORD-1704067200000 is being prepared. Track it here: https://fooda.com/track/order-uuid"
}
```

---

## 9. Error Handling

### Standard Error Response Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "specific_field",
      "reason": "Detailed reason"
    },
    "timestamp": "2024-01-01T00:00:00Z",
    "path": "/rest/v1/orders"
  }
}
```

---

### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET, PATCH, DELETE |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE with no response |
| 400 | Bad Request | Invalid request body or parameters |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Authenticated but not authorized |
| 404 | Not Found | Resource not found |
| 406 | Not Acceptable | Multiple results when single expected |
| 409 | Conflict | Resource already exists |
| 422 | Unprocessable Entity | Validation errors |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

---

### Common Error Codes

```typescript
// Authentication Errors
AUTH_001: "Invalid credentials"
AUTH_002: "Token expired"
AUTH_003: "Insufficient permissions"
AUTH_004: "Email already registered"

// Validation Errors
VAL_001: "Required field missing"
VAL_002: "Invalid format"
VAL_003: "Value out of range"

// Business Logic Errors
BUS_001: "Vendor not active"
BUS_002: "Menu item not available"
BUS_003: "Insufficient wallet balance"
BUS_004: "Order cannot be cancelled"
BUS_005: "Invalid status transition"

// Resource Errors
RES_001: "Resource not found"
RES_002: "Resource already exists"
RES_003: "Resource deleted"
```

---

### Error Handling Example (Flutter)

```dart
try {
  final response = await supabase
    .from('orders')
    .insert(orderData)
    .select()
    .single();
    
  // Success
  return Order.fromJson(response);
  
} on PostgrestException catch (error) {
  // Handle Supabase errors
  switch (error.code) {
    case '23505': // Unique violation
      throw 'Order already exists';
    case '23503': // Foreign key violation
      throw 'Invalid vendor or menu item';
    default:
      throw 'Failed to create order: ${error.message}';
  }
} catch (error) {
  // Handle other errors
  throw 'Unexpected error: $error';
}
```

---

## 10. API Versioning

### Current Version: v1

**Base URL**: `https://dukvrgupgtymxxbqpctq.supabase.co/rest/v1`

### Version Header

```http
Accept: application/vnd.fooda.v1+json
```

### Deprecation Policy

- Versions supported for minimum 6 months after deprecation notice
- Breaking changes require new version
- Backward-compatible changes don't require version bump

### Version History

| Version | Release Date | Status | Notes |
|---------|--------------|--------|-------|
| v1.0.0 | 2024-01-01 | Active | Initial release |

---

## Rate Limiting

### Limits

| Endpoint Type | Requests per Minute |
|---------------|---------------------|
| Authentication | 10 |
| Read Operations | 100 |
| Write Operations | 30 |
| Real-time Subscriptions | 50 concurrent |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067260
```

### Rate Limit Exceeded Response

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "retry_after": 60
  }
}
```

---

## Testing

### Test Credentials

```json
{
  "customer": {
    "email": "test.customer@fooda.com",
    "password": "TestPass123!"
  },
  "vendor": {
    "email": "test.vendor@fooda.com",
    "password": "TestPass123!"
  },
  "admin": {
    "email": "test.admin@fooda.com",
    "password": "TestPass123!"
  }
}
```

### Test Environment

**URL**: `https://dukvrgupgtymxxbqpctq.supabase.co`  
**Note**: Currently using production database. Test environment to be set up.

---

## Flutter Integration Example

### Setup Supabase Client

```dart
import 'package:supabase_flutter/supabase_flutter.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  await Supabase.initialize(
    url: 'https://dukvrgupgtymxxbqpctq.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  );
  
  runApp(MyApp());
}

final supabase = Supabase.instance.client;
```

### Login Example

```dart
Future<void> login(String email, String password) async {
  try {
    final response = await supabase.auth.signInWithPassword(
      email: email,
      password: password,
    );
    
    final user = response.user;
    final role = user?.userMetadata?['role'];
    
    // Navigate based on role
    if (role == 'customer') {
      Navigator.pushReplacementNamed(context, '/home');
    } else if (role == 'vendor') {
      Navigator.pushReplacementNamed(context, '/vendor-dashboard');
    }
    
  } on AuthException catch (error) {
    showError(error.message);
  }
}
```

### Fetch Vendors Example

```dart
Future<List<Vendor>> fetchVendors() async {
  try {
    final response = await supabase
      .from('vendors')
      .select()
      .eq('is_active', true)
      .order('name');
      
    return (response as List)
      .map((json) => Vendor.fromJson(json))
      .toList();
      
  } on PostgrestException catch (error) {
    throw 'Failed to load vendors: ${error.message}';
  }
}
```

### Create Order Example

```dart
Future<Order> createOrder(OrderData orderData) async {
  try {
    // Create order
    final orderResponse = await supabase
      .from('orders')
      .insert(orderData.toJson())
      .select()
      .single();
      
    final orderId = orderResponse['id'];
    
    // Create order items
    await supabase
      .from('order_items')
      .insert(
        orderData.items.map((item) => {
          'order_id': orderId,
          'menu_item_id': item.menuItemId,
          'quantity': item.quantity,
          'price_per_unit': item.price,
          'total_price': item.price * item.quantity,
        }).toList()
      );
      
    return Order.fromJson(orderResponse);
    
  } on PostgrestException catch (error) {
    throw 'Failed to create order: ${error.message}';
  }
}
```

### Real-time Order Tracking

```dart
StreamSubscription? _orderSubscription;

void trackOrder(String orderId) {
  _orderSubscription = supabase
    .channel('order_$orderId')
    .on(
      RealtimeListenTypes.postgresChanges,
      ChannelFilter(
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: 'id=eq.$orderId',
      ),
      (payload) {
        final updatedOrder = Order.fromJson(payload.newRecord);
        setState(() {
          order = updatedOrder;
        });
      },
    )
    .subscribe();
}

@override
void dispose() {
  _orderSubscription?.cancel();
  super.dispose();
}
```

---

## Support & Resources

### Documentation
- **Supabase Docs**: https://supabase.com/docs
- **Flutter Supabase**: https://supabase.com/docs/reference/dart

### Contact
- **Email**: support@fooda.com
- **Developer Portal**: https://developers.fooda.com

### Changelog
- **v1.0.0** (2024-01-01): Initial API release

---

## Appendix

### Database Schema Overview

```
users
├── id (uuid, PK)
├── email (text)
├── role (text)
├── full_name (text)
├── phone (text)
├── avatar_url (text)
├── is_active (boolean)
└── created_at (timestamp)

vendors
├── id (uuid, PK)
├── owner_id (uuid, FK → users.id)
├── name (text)
├── email (text)
├── phone (text)
├── description (text)
├── image_url (text)
├── is_active (boolean)
└── created_at (timestamp)

menu_categories
├── id (uuid, PK)
├── vendor_id (uuid, FK → vendors.id)
├── name (text)
├── description (text)
├── is_active (boolean)
├── sort_order (integer)
└── created_at (timestamp)

menu_items
├── id (uuid, PK)
├── vendor_id (uuid, FK → vendors.id)
├── category_id (uuid, FK → menu_categories.id)
├── name (text)
├── description (text)
├── price (numeric)
├── image_url (text)
├── is_available (boolean)
├── is_vegetarian (boolean)
├── is_vegan (boolean)
├── prep_time (integer)
├── sort_order (integer)
└── created_at (timestamp)

menu_item_addons
├── id (uuid, PK)
├── menu_item_id (uuid, FK → menu_items.id)
├── name (text)
├── price (numeric)
├── is_available (boolean)
├── sort_order (integer)
└── created_at (timestamp)

orders
├── id (uuid, PK)
├── customer_id (uuid, FK → users.id)
├── vendor_id (uuid, FK → vendors.id)
├── rider_id (uuid, FK → delivery_riders.id)
├── order_number (text)
├── status (text)
├── subtotal (numeric)
├── tax_amount (numeric)
├── delivery_fee (numeric)
├── total_amount (numeric)
├── payment_method (text)
├── payment_status (text)
├── payment_reference (text)
├── delivery_address (jsonb)
├── delivery_latitude (numeric)
├── delivery_longitude (numeric)
├── notes (text)
├── estimated_delivery_time (timestamp)
├── actual_delivery_time (timestamp)
└── created_at (timestamp)

order_items
├── id (uuid, PK)
├── order_id (uuid, FK → orders.id)
├── menu_item_id (uuid, FK → menu_items.id)
├── quantity (integer)
├── price_per_unit (numeric)
├── total_price (numeric)
├── special_instructions (text)
└── created_at (timestamp)
```

---

**End of Documentation**

*Last Updated: 2024-01-03*  
*Version: 1.0.0*
