// Database types
export interface User {
    id: string;
    email: string;
    phone?: string;
    full_name?: string;
    avatar_url?: string;
    role: 'customer' | 'vendor' | 'delivery_person' | 'admin';
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface Vendor {
    id: string;
    owner_id: string;
    name: string;
    description?: string;
    address?: any;
    phone?: string;
    email?: string;
    business_hours?: any;
    logo_url?: string;
    cover_image_url?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface MenuCategory {
    id: string;
    vendor_id: string;
    name: string;
    description?: string;
    is_active: boolean;
    sort_order: number;
    created_at: string;
}

export interface MenuItem {
    id: string;
    vendor_id: string;
    category_id?: string;
    name: string;
    description?: string;
    price: number;
    image_url?: string;
    is_available: boolean;
    is_vegetarian: boolean;
    is_vegan: boolean;
    prep_time?: number;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

export interface Order {
    id: string;
    customer_id?: string;
    vendor_id?: string;
    delivery_person_id?: string;
    order_number: string;
    status: 'pending' | 'confirmed' | 'preparing' | 'ready_for_pickup' | 'picked_up' | 'delivered' | 'cancelled';
    subtotal: number;
    tax_amount: number;
    delivery_fee: number;
    total_amount: number;
    payment_method?: 'cash' | 'card' | 'paypal' | 'wallet';
    payment_status: 'pending' | 'completed' | 'failed' | 'refunded';
    delivery_address?: any;
    delivery_latitude?: number;
    delivery_longitude?: number;
    estimated_prep_time?: number;
    estimated_delivery_time?: string;
    actual_delivery_time?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
}

export interface OrderItem {
    id: string;
    order_id: string;
    menu_item_id?: string;
    quantity: number;
    price_per_unit: number;
    total_price: number;
    special_instructions?: string;
    created_at: string;
}

export interface PlatformSetting {
    id: string;
    setting_key: string;
    setting_value: string;
    setting_type: 'string' | 'number' | 'boolean' | 'json';
    description?: string;
    updated_at: string;
    updated_by?: string;
}

export interface MenuItemAddon {
    id: string;
    menu_item_id: string;
    name: string;
    price: number;
    is_available: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
}
