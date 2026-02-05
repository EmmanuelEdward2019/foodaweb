import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Vendor, MenuItem, MenuCategory, Order } from '../../lib/types';
import { Plus, Edit2, Trash2, ShoppingBag, Settings, TrendingUp, X } from 'lucide-react';

type TabType = 'overview' | 'menu' | 'orders' | 'settings';

const VendorDashboard = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<MenuCategory[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [stats, setStats] = useState({
        todayOrders: 0,
        pendingOrders: 0,
        todayRevenue: 0,
        totalMenuItems: 0
    });
    const [loading, setLoading] = useState(true);
    const [showMenuModal, setShowMenuModal] = useState(false);
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

    useEffect(() => {
        fetchData();
    }, [user]);

    const fetchData = async () => {
        if (!user) return;

        setLoading(true);
        try {
            // First, ensure user exists in users table
            const { data: userData, error: userCheckError } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

            // If user doesn't exist in users table, create it
            if (!userData && !userCheckError) {
                console.log('User record not found, creating one...');

                const { error: userCreateError } = await supabase
                    .from('users')
                    .insert({
                        id: user.id,
                        email: user.email,
                        role: user.user_metadata?.role || 'vendor',
                        full_name: user.user_metadata?.business_name || user.user_metadata?.full_name || user.email?.split('@')[0],
                        phone: user.user_metadata?.phone || null,
                        is_active: true
                    });

                if (userCreateError) {
                    console.error('Error creating user record:', userCreateError);
                    // Continue anyway, the vendor profile creation might still work
                }
            }

            // Fetch vendor profile
            console.log('Fetching vendor profile for user:', user.id, user.email);
            const { data: vendorData, error: vendorError } = await supabase
                .from('vendors')
                .select('*')
                .eq('owner_id', user.id)
                .maybeSingle();

            console.log('Vendor fetch result:', { vendorData, vendorError });

            if (vendorError) {
                console.error('Error fetching vendor profile:', vendorError);
                // Don't throw, try to create instead
            }

            let currentVendor = vendorData;

            // If vendor profile doesn't exist, create it
            if (!currentVendor && !vendorError) {
                console.log('Vendor profile not found, creating one...');

                const businessName = user.user_metadata?.business_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'My Restaurant';

                const { data: newVendor, error: createError } = await supabase
                    .from('vendors')
                    .insert({
                        owner_id: user.id,
                        name: businessName,
                        email: user.email,
                        is_active: true
                    })
                    .select()
                    .single();

                if (createError) {
                    console.error('Error creating vendor profile:', createError);
                    throw new Error(`Failed to create vendor profile: ${createError.message}`);
                }

                currentVendor = newVendor;
                console.log('Vendor profile created successfully:', newVendor);
            }

            if (!currentVendor) {
                console.error('No vendor profile found and could not create one');
                throw new Error('No vendor profile found. Please contact support.');
            }

            if (currentVendor) {
                setVendor(currentVendor);

                // Fetch all vendor data in parallel for better performance
                const [menuResult, categoriesResult, ordersResult] = await Promise.all([
                    supabase
                        .from('menu_items')
                        .select('*')
                        .eq('vendor_id', currentVendor.id)
                        .order('sort_order', { ascending: true })
                        .limit(100), // Limit to 100 menu items

                    supabase
                        .from('menu_categories')
                        .select('*')
                        .eq('vendor_id', currentVendor.id)
                        .order('sort_order', { ascending: true }),

                    supabase
                        .from('orders')
                        .select('*')
                        .eq('vendor_id', currentVendor.id)
                        .order('created_at', { ascending: false })
                        .limit(50) // Limit to recent 50 orders
                ]);

                const menuData = menuResult.data;
                const categoriesData = categoriesResult.data;
                const ordersData = ordersResult.data;

                setMenuItems(menuData || []);
                setCategories(categoriesData || []);
                setOrders(ordersData || []);

                // Calculate stats
                const today = new Date().toISOString().split('T')[0];
                const todayOrders = (ordersData || []).filter(o =>
                    o.created_at.startsWith(today)
                ).length;
                const pendingOrders = (ordersData || []).filter(o =>
                    o.status === 'pending' || o.status === 'confirmed'
                ).length;
                const todayRevenue = (ordersData || [])
                    .filter(o => o.created_at.startsWith(today) && o.payment_status === 'completed')
                    .reduce((sum, o) => sum + Number(o.total_amount), 0);

                setStats({
                    todayOrders,
                    pendingOrders,
                    todayRevenue,
                    totalMenuItems: menuData?.length || 0
                });
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await signOut();
        navigate('/auth');
    };

    const deleteMenuItem = async (itemId: string) => {
        if (!confirm('Are you sure you want to delete this menu item?')) return;

        try {
            const { error } = await supabase
                .from('menu_items')
                .delete()
                .eq('id', itemId);

            if (error) throw error;
            fetchData();
        } catch (error) {
            console.error('Error deleting menu item:', error);
            alert('Failed to delete menu item');
        }
    };

    const toggleItemAvailability = async (itemId: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('menu_items')
                .update({ is_available: !currentStatus })
                .eq('id', itemId);

            if (error) throw error;
            fetchData();
        } catch (error) {
            console.error('Error updating item:', error);
            alert('Failed to update item availability');
        }
    };

    const updateOrderStatus = async (orderId: string, newStatus: string) => {
        try {
            const { error } = await supabase
                .from('orders')
                .update({ status: newStatus })
                .eq('id', orderId);

            if (error) throw error;
            fetchData();
        } catch (error) {
            console.error('Error updating order:', error);
            alert('Failed to update order status');
        }
    };

    const renderOverview = () => (
        <div>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '20px',
                marginBottom: '40px'
            }}>
                <StatCard
                    icon={<ShoppingBag size={24} />}
                    title="Today's Orders"
                    value={stats.todayOrders}
                    subtitle="Orders received today"
                    color="#ff6b35"
                />
                <StatCard
                    icon={<TrendingUp size={24} />}
                    title="Pending Orders"
                    value={stats.pendingOrders}
                    subtitle="Needs attention"
                    color="#FF9800"
                />
                <StatCard
                    icon={<TrendingUp size={24} />}
                    title="Today's Revenue"
                    value={`₦${stats.todayRevenue.toLocaleString()}`}
                    subtitle="Completed orders"
                    color="#4CAF50"
                />
                <StatCard
                    icon={<ShoppingBag size={24} />}
                    title="Menu Items"
                    value={stats.totalMenuItems}
                    subtitle="Total items"
                    color="#2196F3"
                />
            </div>

            <div style={{
                backgroundColor: '#fff',
                padding: '24px',
                borderRadius: '12px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
                <h3 style={{ marginBottom: '20px', color: '#333' }}>Recent Orders</h3>
                {orders.slice(0, 5).length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #eee' }}>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>Order #</th>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>Status</th>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>Amount</th>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.slice(0, 5).map(order => (
                                    <tr key={order.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                        <td style={{ padding: '12px' }}>{order.order_number}</td>
                                        <td style={{ padding: '12px' }}>
                                            <StatusBadge status={order.status} />
                                        </td>
                                        <td style={{ padding: '12px' }}>₦{Number(order.total_amount).toLocaleString()}</td>
                                        <td style={{ padding: '12px' }}>{new Date(order.created_at).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>No orders yet</p>
                )}
            </div>
        </div>
    );

    const renderMenu = () => (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ color: '#333' }}>Menu Items</h3>
                <button
                    onClick={() => {
                        setEditingItem(null);
                        setShowMenuModal(true);
                    }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 20px',
                        backgroundColor: '#ff6b35',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '500'
                    }}
                >
                    <Plus size={18} />
                    Add Menu Item
                </button>
            </div>

            <div style={{
                backgroundColor: '#fff',
                padding: '24px',
                borderRadius: '12px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
                {menuItems.length > 0 ? (
                    <div style={{ display: 'grid', gap: '16px' }}>
                        {menuItems.map(item => (
                            <div key={item.id} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '16px',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px'
                            }}>
                                <div style={{ flex: 1 }}>
                                    <h4 style={{ color: '#333', marginBottom: '4px' }}>{item.name}</h4>
                                    <p style={{ color: '#666', fontSize: '14px', marginBottom: '8px' }}>
                                        {item.description || 'No description'}
                                    </p>
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 'bold', color: '#ff6b35' }}>
                                            ₦{Number(item.price).toLocaleString()}
                                        </span>
                                        <span style={{
                                            padding: '2px 8px',
                                            borderRadius: '8px',
                                            fontSize: '12px',
                                            backgroundColor: item.is_available ? '#dcfce7' : '#fee2e2',
                                            color: item.is_available ? '#16a34a' : '#dc2626'
                                        }}>
                                            {item.is_available ? 'Available' : 'Unavailable'}
                                        </span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => toggleItemAvailability(item.id, item.is_available)}
                                        style={{
                                            padding: '8px 16px',
                                            backgroundColor: item.is_available ? '#fef3c7' : '#dcfce7',
                                            color: item.is_available ? '#d97706' : '#16a34a',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontSize: '14px'
                                        }}
                                    >
                                        {item.is_available ? 'Mark Unavailable' : 'Mark Available'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditingItem(item);
                                            setShowMenuModal(true);
                                        }}
                                        style={{
                                            padding: '8px',
                                            backgroundColor: '#e0e7ff',
                                            color: '#4f46e5',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => deleteMenuItem(item.id)}
                                        style={{
                                            padding: '8px',
                                            backgroundColor: '#fee2e2',
                                            color: '#dc2626',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p style={{ color: '#999', textAlign: 'center', padding: '40px' }}>
                        No menu items yet. Click "Add Menu Item" to get started!
                    </p>
                )}
            </div>
        </div>
    );

    const renderOrders = () => (
        <div style={{
            backgroundColor: '#fff',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
            <h3 style={{ marginBottom: '20px', color: '#333' }}>All Orders</h3>
            {orders.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #eee' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Order #</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Status</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Payment</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Amount</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map(order => (
                                <tr key={order.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                    <td style={{ padding: '12px' }}>{order.order_number}</td>
                                    <td style={{ padding: '12px' }}>
                                        <StatusBadge status={order.status} />
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        <span style={{
                                            padding: '4px 8px',
                                            borderRadius: '8px',
                                            fontSize: '12px',
                                            backgroundColor: order.payment_status === 'completed' ? '#dcfce7' : '#fef3c7',
                                            color: order.payment_status === 'completed' ? '#16a34a' : '#d97706'
                                        }}>
                                            {order.payment_status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px' }}>₦{Number(order.total_amount).toLocaleString()}</td>
                                    <td style={{ padding: '12px' }}>{new Date(order.created_at).toLocaleDateString()}</td>
                                    <td style={{ padding: '12px' }}>
                                        <select
                                            value={order.status}
                                            onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                                            style={{
                                                padding: '6px 12px',
                                                borderRadius: '6px',
                                                border: '1px solid #ddd',
                                                fontSize: '14px'
                                            }}
                                        >
                                            <option value="pending">Pending</option>
                                            <option value="confirmed">Confirmed</option>
                                            <option value="preparing">Preparing</option>
                                            <option value="ready_for_pickup">Ready for Pickup</option>
                                            <option value="picked_up">Picked Up</option>
                                            <option value="delivered">Delivered</option>
                                            <option value="cancelled">Cancelled</option>
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>No orders yet</p>
            )}
        </div>
    );

    const renderSettings = () => (
        <div style={{
            backgroundColor: '#fff',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
            <h3 style={{ marginBottom: '20px', color: '#333' }}>Restaurant Settings</h3>
            {vendor ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <h4 style={{ marginBottom: '10px', color: '#555' }}>Restaurant Information</h4>
                        <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                            <p style={{ color: '#666', marginBottom: '8px' }}><strong>Name:</strong> {vendor.name}</p>
                            <p style={{ color: '#666', marginBottom: '8px' }}><strong>Email:</strong> {vendor.email || 'Not set'}</p>
                            <p style={{ color: '#666', marginBottom: '8px' }}><strong>Phone:</strong> {vendor.phone || 'Not set'}</p>
                            <p style={{ color: '#666' }}><strong>Status:</strong> {vendor.is_active ? 'Active' : 'Inactive'}</p>
                        </div>
                    </div>
                    <div>
                        <h4 style={{ marginBottom: '10px', color: '#555' }}>Description</h4>
                        <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                            <p style={{ color: '#666' }}>{vendor.description || 'No description set'}</p>
                        </div>
                    </div>
                </div>
            ) : (
                <p style={{ color: '#999' }}>No vendor profile found. Please contact support.</p>
            )}
        </div>
    );

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        width: '50px',
                        height: '50px',
                        border: '4px solid #f3f3f3',
                        borderTop: '4px solid #ff6b35',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 20px'
                    }} />
                    <p style={{ color: '#666' }}>Loading dashboard...</p>
                </div>
            </div>
        );
    }

    if (!vendor) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <h2 style={{ color: '#333', marginBottom: '20px' }}>No Vendor Profile Found</h2>
                <p style={{ color: '#666', marginBottom: '20px' }}>
                    Please contact support to set up your vendor profile.
                </p>
                <button
                    onClick={handleLogout}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: '#ff6b35',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer'
                    }}
                >
                    Logout
                </button>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
            <header style={{
                backgroundColor: '#fff',
                borderBottom: '1px solid #e5e7eb',
                padding: '20px 40px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                        {vendor.name}
                    </h1>
                    <p style={{ color: '#666', fontSize: '14px' }}>
                        Welcome, {user?.user_metadata?.business_name || user?.email}
                    </p>
                </div>
                <button
                    onClick={handleLogout}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: '#ff6b35',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '500',
                        fontSize: '14px'
                    }}
                >
                    Logout
                </button>
            </header>

            <div style={{ padding: '40px' }}>
                <div style={{ marginBottom: '30px', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', gap: '30px' }}>
                        <TabButton
                            active={activeTab === 'overview'}
                            onClick={() => setActiveTab('overview')}
                            icon={<TrendingUp size={18} />}
                            label="Overview"
                        />
                        <TabButton
                            active={activeTab === 'menu'}
                            onClick={() => setActiveTab('menu')}
                            icon={<ShoppingBag size={18} />}
                            label="Menu Items"
                        />
                        <TabButton
                            active={activeTab === 'orders'}
                            onClick={() => setActiveTab('orders')}
                            icon={<ShoppingBag size={18} />}
                            label="Orders"
                        />
                        <TabButton
                            active={activeTab === 'settings'}
                            onClick={() => setActiveTab('settings')}
                            icon={<Settings size={18} />}
                            label="Settings"
                        />
                    </div>
                </div>

                <div style={{ maxWidth: '1400px' }}>
                    {activeTab === 'overview' && renderOverview()}
                    {activeTab === 'menu' && renderMenu()}
                    {activeTab === 'orders' && renderOrders()}
                    {activeTab === 'settings' && renderSettings()}
                </div>
            </div>

            {showMenuModal && (
                <MenuItemModal
                    vendor={vendor}
                    item={editingItem}
                    categories={categories}
                    onClose={() => {
                        setShowMenuModal(false);
                        setEditingItem(null);
                    }}
                    onSave={() => {
                        setShowMenuModal(false);
                        setEditingItem(null);
                        fetchData();
                    }}
                />
            )}

            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

// Helper Components
const StatCard = ({ icon, title, value, subtitle, color }: any) => (
    <div style={{
        backgroundColor: '#fff',
        padding: '24px',
        borderRadius: '12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
    }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ color, marginRight: '12px' }}>{icon}</div>
            <h3 style={{ fontSize: '14px', color: '#666', fontWeight: '500' }}>{title}</h3>
        </div>
        <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
            {value}
        </p>
        <p style={{ fontSize: '12px', color: '#999' }}>{subtitle}</p>
    </div>
);

const TabButton = ({ active, onClick, icon, label }: any) => (
    <button
        onClick={onClick}
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 0',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: active ? '2px solid #ff6b35' : '2px solid transparent',
            color: active ? '#ff6b35' : '#666',
            cursor: 'pointer',
            fontWeight: active ? '600' : '400',
            fontSize: '14px',
            transition: 'all 0.2s'
        }}
    >
        {icon}
        {label}
    </button>
);

const StatusBadge = ({ status }: { status: string }) => {
    const colors: any = {
        pending: { bg: '#fef3c7', color: '#d97706' },
        confirmed: { bg: '#dbeafe', color: '#2563eb' },
        preparing: { bg: '#fce7f3', color: '#db2777' },
        ready_for_pickup: { bg: '#e0e7ff', color: '#6366f1' },
        picked_up: { bg: '#ddd6fe', color: '#7c3aed' },
        delivered: { bg: '#dcfce7', color: '#16a34a' },
        cancelled: { bg: '#fee2e2', color: '#dc2626' }
    };

    const style = colors[status] || colors.pending;

    return (
        <span style={{
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '500',
            backgroundColor: style.bg,
            color: style.color
        }}>
            {status.replace(/_/g, ' ')}
        </span>
    );
};

const MenuItemModal = ({ vendor, item, categories, onClose, onSave }: any) => {
    const [formData, setFormData] = useState({
        name: item?.name || '',
        description: item?.description || '',
        price: item?.price || '',
        category_id: item?.category_id || '',
        image_url: item?.image_url || '',
        is_available: item?.is_available ?? true,
        is_vegetarian: item?.is_vegetarian || false,
        is_vegan: item?.is_vegan || false,
        prep_time: item?.prep_time || ''
    });
    const [addons, setAddons] = useState<any[]>([]);
    const [newAddon, setNewAddon] = useState({ name: '', price: '' });
    const [saving, setSaving] = useState(false);

    // Load existing addons if editing
    useEffect(() => {
        if (item?.id) {
            loadAddons();
        }
    }, [item]);

    const loadAddons = async () => {
        if (!item?.id) return;

        const { data } = await supabase
            .from('menu_item_addons')
            .select('*')
            .eq('menu_item_id', item.id)
            .order('sort_order');

        setAddons(data || []);
    };

    const handleAddAddon = () => {
        if (!newAddon.name || !newAddon.price) {
            alert('Please enter addon name and price');
            return;
        }

        setAddons([...addons, {
            id: `temp_${Date.now()}`,
            name: newAddon.name,
            price: parseFloat(newAddon.price),
            is_available: true,
            sort_order: addons.length
        }]);
        setNewAddon({ name: '', price: '' });
    };

    const handleRemoveAddon = (index: number) => {
        setAddons(addons.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const data = {
                ...formData,
                vendor_id: vendor.id,
                price: parseFloat(formData.price as any),
                prep_time: formData.prep_time ? parseInt(formData.prep_time as any) : null,
                category_id: formData.category_id || null, // Convert empty string to null
                image_url: formData.image_url || null // Convert empty string to null
            };

            let menuItemId = item?.id;

            if (item) {
                // Update existing item
                const { error } = await supabase
                    .from('menu_items')
                    .update(data)
                    .eq('id', item.id);

                if (error) throw error;
            } else {
                // Create new item
                const { data: newItem, error } = await supabase
                    .from('menu_items')
                    .insert(data)
                    .select()
                    .single();

                if (error) throw error;
                menuItemId = newItem.id;
            }

            // Save addons
            if (menuItemId) {
                // Delete existing addons
                await supabase
                    .from('menu_item_addons')
                    .delete()
                    .eq('menu_item_id', menuItemId);

                // Insert new addons
                if (addons.length > 0) {
                    const addonsToInsert = addons.map((addon, index) => ({
                        menu_item_id: menuItemId,
                        name: addon.name,
                        price: addon.price,
                        is_available: true,
                        sort_order: index
                    }));

                    const { error: addonsError } = await supabase
                        .from('menu_item_addons')
                        .insert(addonsToInsert);

                    if (addonsError) throw addonsError;
                }
            }

            alert('Menu item saved successfully!');
            onSave();
        } catch (error: any) {
            console.error('Error saving menu item:', error);
            alert(`Failed to save menu item: ${error.message || 'Unknown error'}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '24px',
                maxWidth: '500px',
                width: '90%',
                maxHeight: '90vh',
                overflowY: 'auto'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ color: '#333' }}>{item ? 'Edit Menu Item' : 'Add Menu Item'}</h3>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#666'
                        }}
                    >
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: '#555', fontWeight: '500' }}>
                            Item Name *
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '6px',
                                fontSize: '14px'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: '#555', fontWeight: '500' }}>
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '6px',
                                fontSize: '14px',
                                resize: 'vertical'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: '#555', fontWeight: '500' }}>
                            Price (₦) *
                        </label>
                        <input
                            type="number"
                            required
                            step="0.01"
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '6px',
                                fontSize: '14px'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: '#555', fontWeight: '500' }}>
                            Image URL
                        </label>
                        <input
                            type="url"
                            value={formData.image_url}
                            onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                            placeholder="https://example.com/image.jpg"
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '6px',
                                fontSize: '14px'
                            }}
                        />
                        {formData.image_url && (
                            <img
                                src={formData.image_url}
                                alt="Preview"
                                style={{
                                    marginTop: '8px',
                                    maxWidth: '100%',
                                    maxHeight: '150px',
                                    borderRadius: '8px',
                                    objectFit: 'cover'
                                }}
                                onError={(e: any) => e.target.style.display = 'none'}
                            />
                        )}
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: '#555', fontWeight: '500' }}>
                            Preparation Time (minutes)
                        </label>
                        <input
                            type="number"
                            value={formData.prep_time}
                            onChange={(e) => setFormData({ ...formData, prep_time: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '6px',
                                fontSize: '14px'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={formData.is_available}
                                onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
                            />
                            <span style={{ color: '#555' }}>Available for order</span>
                        </label>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={formData.is_vegetarian}
                                onChange={(e) => setFormData({ ...formData, is_vegetarian: e.target.checked })}
                            />
                            <span style={{ color: '#555' }}>Vegetarian</span>
                        </label>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={formData.is_vegan}
                                onChange={(e) => setFormData({ ...formData, is_vegan: e.target.checked })}
                            />
                            <span style={{ color: '#555' }}>Vegan</span>
                        </label>
                    </div>

                    {/* Addons Section */}
                    <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                        <h4 style={{ marginBottom: '12px', color: '#333', fontSize: '16px', fontWeight: '600' }}>
                            Add-ons (Optional)
                        </h4>
                        <p style={{ marginBottom: '12px', color: '#666', fontSize: '13px' }}>
                            Add extra items customers can add to this menu item (e.g., Chicken, Drinks, Salad)
                        </p>

                        {/* Existing Addons List */}
                        {addons.length > 0 && (
                            <div style={{ marginBottom: '12px' }}>
                                {addons.map((addon, index) => (
                                    <div
                                        key={addon.id || index}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '8px 12px',
                                            backgroundColor: 'white',
                                            borderRadius: '6px',
                                            marginBottom: '8px',
                                            border: '1px solid #e5e7eb'
                                        }}
                                    >
                                        <div>
                                            <span style={{ fontWeight: '500', color: '#333' }}>{addon.name}</span>
                                            <span style={{ color: '#666', marginLeft: '8px' }}>₦{addon.price}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveAddon(index)}
                                            style={{
                                                padding: '4px 8px',
                                                backgroundColor: '#fee2e2',
                                                color: '#dc2626',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '12px'
                                            }}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add New Addon */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                            <input
                                type="text"
                                placeholder="Addon name (e.g., Extra Chicken)"
                                value={newAddon.name}
                                onChange={(e) => setNewAddon({ ...newAddon, name: e.target.value })}
                                style={{
                                    flex: 2,
                                    padding: '8px',
                                    border: '1px solid #ddd',
                                    borderRadius: '6px',
                                    fontSize: '14px'
                                }}
                            />
                            <input
                                type="number"
                                placeholder="Price"
                                step="0.01"
                                value={newAddon.price}
                                onChange={(e) => setNewAddon({ ...newAddon, price: e.target.value })}
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    border: '1px solid #ddd',
                                    borderRadius: '6px',
                                    fontSize: '14px'
                                }}
                            />
                            <button
                                type="button"
                                onClick={handleAddAddon}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#16a34a',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '500'
                                }}
                            >
                                Add
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                flex: 1,
                                padding: '12px',
                                backgroundColor: '#f3f4f6',
                                color: '#333',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: '500'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            style={{
                                flex: 1,
                                padding: '12px',
                                backgroundColor: '#ff6b35',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: saving ? 'not-allowed' : 'pointer',
                                fontWeight: '500',
                                opacity: saving ? 0.7 : 1
                            }}
                        >
                            {saving ? 'Saving...' : (item ? 'Update' : 'Add Item')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default VendorDashboard;
