// Database types for Supabase tables (Vendor Dashboard)

export interface User {
    id: string;
    email: string;
    phone: string | null;
    full_name: string | null;
    avatar_url: string | null;
    role: 'customer' | 'vendor' | 'delivery_person' | 'admin';
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface Vendor {
    id: string;
    owner_id: string;
    name: string;
    description: string | null;
    address: {
        street: string;
        city: string;
        state: string;
        postal_code: string;
        country: string;
        latitude?: number;
        longitude?: number;
    } | null;
    phone: string | null;
    email: string | null;
    business_hours: {
        [key: string]: { open: string; close: string; closed?: boolean };
    } | null;
    logo_url: string | null;
    cover_image_url: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface MenuCategory {
    id: string;
    vendor_id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    sort_order: number;
    created_at: string;
}

export interface MenuItem {
    id: string;
    vendor_id: string;
    category_id: string | null;
    name: string;
    description: string | null;
    price: number;
    image_url: string | null;
    is_available: boolean;
    is_vegetarian: boolean;
    is_vegan: boolean;
    prep_time: number | null;
    sort_order: number;
    created_at: string;
    updated_at: string;
    category?: MenuCategory;
}

export interface Order {
    id: string;
    customer_id: string | null;
    vendor_id: string | null;
    delivery_person_id: string | null;
    order_number: string;
    status: 'pending' | 'confirmed' | 'preparing' | 'ready_for_pickup' | 'picked_up' | 'delivered' | 'cancelled';
    subtotal: number;
    tax_amount: number;
    delivery_fee: number;
    total_amount: number;
    payment_method: 'cash' | 'card' | 'paypal' | 'wallet' | null;
    payment_status: 'pending' | 'completed' | 'failed' | 'refunded';
    delivery_address: {
        street: string;
        city: string;
        state: string;
        postal_code: string;
        country: string;
    } | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    customer?: User;
    order_items?: OrderItem[];
}

export interface OrderItem {
    id: string;
    order_id: string;
    menu_item_id: string | null;
    quantity: number;
    price_per_unit: number;
    total_price: number;
    special_instructions: string | null;
    created_at: string;
    menu_item?: MenuItem;
}

export interface Review {
    id: string;
    customer_id: string | null;
    vendor_id: string | null;
    order_id: string | null;
    rating: number;
    comment: string | null;
    is_verified: boolean;
    created_at: string;
    customer?: User;
}

export interface VendorStats {
    todayOrders: number;
    todayRevenue: number;
    pendingOrders: number;
    averageRating: number;
    totalMenuItems: number;
    activeMenuItems: number;
}
