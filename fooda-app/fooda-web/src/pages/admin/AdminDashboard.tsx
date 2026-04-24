import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Vendor, Order } from '../../lib/types';
import { Users, ShoppingBag, Settings, TrendingUp, Clock } from 'lucide-react';

type TabType = 'overview' | 'vendors' | 'orders' | 'settings';

const AdminDashboard = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [stats, setStats] = useState({
        totalVendors: 0,
        activeVendors: 0,
        totalOrders: 0,
        totalRevenue: 0,
        pendingOrders: 0
    });
    const [loading, setLoading] = useState(true);
    const [showVendorModal, setShowVendorModal] = useState(false);
    const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
    const [settings, setSettings] = useState<any>({});
    const [editingSettings, setEditingSettings] = useState(false);
    const [settingsForm, setSettingsForm] = useState<any>({});

    useEffect(() => {
        fetchData();
    }, []);


    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch all data in parallel for better performance
            const [vendorsResult, ordersResult, settingsResult] = await Promise.all([
                supabase
                    .from('vendors')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(100), // Limit to recent 100 vendors

                supabase
                    .from('orders')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(100), // Limit to recent 100 orders

                supabase
                    .from('platform_settings')
                    .select('*')
            ]);

            const vendorsData = vendorsResult.data;
            const ordersData = ordersResult.data;
            const settingsData = settingsResult.data;

            setVendors(vendorsData || []);
            setOrders(ordersData || []);

            // Convert settings array to object for easy access
            const settingsObj: any = {};
            (settingsData || []).forEach((setting: any) => {
                settingsObj[setting.setting_key] = setting.setting_value;
            });
            setSettings(settingsObj);
            setSettingsForm(settingsObj);

            // Calculate stats
            const activeVendors = (vendorsData || []).filter(v => v.is_active).length;
            const totalRevenue = (ordersData || [])
                .filter(o => o.payment_status === 'completed')
                .reduce((sum, o) => sum + Number(o.total_amount), 0);
            const pendingOrders = (ordersData || []).filter(o => o.status === 'pending').length;

            setStats({
                totalVendors: vendorsData?.length || 0,
                activeVendors,
                totalOrders: ordersData?.length || 0,
                totalRevenue,
                pendingOrders
            });
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

    const toggleVendorStatus = async (vendorId: string, ownerId: string, currentStatus: boolean) => {
        try {
            // Update vendor status
            const { error: vendorError } = await supabase
                .from('vendors')
                .update({ is_active: !currentStatus })
                .eq('id', vendorId);

            if (vendorError) throw vendorError;

            // Also update user status
            const { error: userError } = await supabase
                .from('users')
                .update({ is_active: !currentStatus })
                .eq('id', ownerId);

            if (userError) throw userError;

            alert(`Vendor ${!currentStatus ? 'activated' : 'deactivated'} successfully!`);
            fetchData();
        } catch (error) {
            console.error('Error updating vendor:', error);
            alert('Failed to update vendor status');
        }
    };


    const deleteVendor = async (vendorId: string, ownerId: string, vendorName: string) => {
        if (!confirm(`Are you sure you want to delete "${vendorName}"? This will also delete all associated menu items and cannot be undone.`)) {
            return;
        }

        try {
            console.log('Starting vendor deletion:', { vendorId, ownerId, vendorName });

            // Delete menu items first (foreign key constraint)
            const { error: menuItemsError } = await supabase
                .from('menu_items')
                .delete()
                .eq('vendor_id', vendorId);

            if (menuItemsError) {
                console.error('Error deleting menu items:', menuItemsError);
                throw new Error(`Failed to delete menu items: ${menuItemsError.message}`);
            }
            console.log('Menu items deleted');

            // Delete menu categories
            const { error: categoriesError } = await supabase
                .from('menu_categories')
                .delete()
                .eq('vendor_id', vendorId);

            if (categoriesError) {
                console.error('Error deleting categories:', categoriesError);
                throw new Error(`Failed to delete categories: ${categoriesError.message}`);
            }
            console.log('Categories deleted');

            // Delete vendor
            const { error: vendorError, count: vendorCount } = await supabase
                .from('vendors')
                .delete()
                .eq('id', vendorId);

            if (vendorError) {
                console.error('Error deleting vendor:', vendorError);
                throw new Error(`Failed to delete vendor: ${vendorError.message}`);
            }
            console.log('Vendor deleted, count:', vendorCount);

            // Delete user record
            const { error: userError, count: userCount } = await supabase
                .from('users')
                .delete()
                .eq('id', ownerId);

            if (userError) {
                console.error('Error deleting user:', userError);
                throw new Error(`Failed to delete user: ${userError.message}`);
            }
            console.log('User deleted, count:', userCount);

            alert('Vendor deleted successfully!');
            await fetchData(); // Refresh the data
        } catch (error: any) {
            console.error('Error deleting vendor:', error);
            alert(error.message || 'Failed to delete vendor. Please check console for details.');
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
                    icon={<Users size={24} />}
                    title="Total Vendors"
                    value={stats.totalVendors}
                    subtitle={`${stats.activeVendors} active`}
                    color="#ff6b35"
                />
                <StatCard
                    icon={<ShoppingBag size={24} />}
                    title="Total Orders"
                    value={stats.totalOrders}
                    subtitle={`${stats.pendingOrders} pending`}
                    color="#4CAF50"
                />
                <StatCard
                    icon={<TrendingUp size={24} />}
                    title="Total Revenue"
                    value={`₦${stats.totalRevenue.toLocaleString()}`}
                    subtitle="All time"
                    color="#2196F3"
                />
                <StatCard
                    icon={<Clock size={24} />}
                    title="Pending Orders"
                    value={stats.pendingOrders}
                    subtitle="Needs attention"
                    color="#FF9800"
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


    const renderVendors = () => (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ color: '#333' }}>Manage Vendors</h3>
                <button
                    onClick={() => setShowVendorModal(true)}
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
                    <Users size={18} />
                    Add Vendor
                </button>
            </div>

            <div style={{
                backgroundColor: '#fff',
                padding: '24px',
                borderRadius: '12px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
                {vendors.length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #eee' }}>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>Name</th>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>Email</th>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>Phone</th>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>Status</th>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {vendors.map(vendor => (
                                    <tr key={vendor.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                        <td style={{ padding: '12px' }}>{vendor.name}</td>
                                        <td style={{ padding: '12px' }}>{vendor.email || 'N/A'}</td>
                                        <td style={{ padding: '12px' }}>{vendor.phone || 'N/A'}</td>
                                        <td style={{ padding: '12px' }}>
                                            <span style={{
                                                padding: '4px 12px',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                fontWeight: '500',
                                                backgroundColor: vendor.is_active ? '#dcfce7' : '#fee2e2',
                                                color: vendor.is_active ? '#16a34a' : '#dc2626'
                                            }}>
                                                {vendor.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => {
                                                        setEditingVendor(vendor);
                                                        setShowVendorModal(true);
                                                    }}
                                                    style={{
                                                        padding: '6px 12px',
                                                        backgroundColor: '#3b82f6',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        fontSize: '14px'
                                                    }}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => toggleVendorStatus(vendor.id, vendor.owner_id, vendor.is_active)}
                                                    style={{
                                                        padding: '6px 12px',
                                                        backgroundColor: vendor.is_active ? '#dc2626' : '#16a34a',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        fontSize: '14px'
                                                    }}
                                                >
                                                    {vendor.is_active ? 'Deactivate' : 'Activate'}
                                                </button>
                                                <button
                                                    onClick={() => deleteVendor(vendor.id, vendor.owner_id, vendor.name)}
                                                    style={{
                                                        padding: '6px 12px',
                                                        backgroundColor: '#ef4444',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        fontSize: '14px'
                                                    }}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>No vendors yet. Click "Add Vendor" to create one!</p>
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

    const handleSaveSettings = async () => {
        try {
            // Update each setting
            const updates = Object.keys(settingsForm).map(key =>
                supabase
                    .from('platform_settings')
                    .update({ setting_value: settingsForm[key] })
                    .eq('setting_key', key)
            );

            await Promise.all(updates);
            setSettings(settingsForm);
            setEditingSettings(false);
            alert('Settings updated successfully!');
        } catch (error) {
            console.error('Error updating settings:', error);
            alert('Failed to update settings');
        }
    };

    const renderSettings = () => (
        <div style={{
            backgroundColor: '#fff',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ color: '#333' }}>System Settings</h3>
                {!editingSettings ? (
                    <button
                        onClick={() => setEditingSettings(true)}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: '#ff6b35',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: '500'
                        }}
                    >
                        Edit Settings
                    </button>
                ) : (
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={() => {
                                setSettingsForm(settings);
                                setEditingSettings(false);
                            }}
                            style={{
                                padding: '10px 20px',
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
                            onClick={handleSaveSettings}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: '#16a34a',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: '500'
                            }}
                        >
                            Save Changes
                        </button>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                    <h4 style={{ marginBottom: '10px', color: '#555' }}>Platform Settings</h4>
                    <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '4px', color: '#666', fontSize: '14px', fontWeight: '500' }}>
                                Delivery Fee (₦)
                            </label>
                            {editingSettings ? (
                                <input
                                    type="number"
                                    value={settingsForm.delivery_fee || ''}
                                    onChange={(e) => setSettingsForm({ ...settingsForm, delivery_fee: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #ddd',
                                        borderRadius: '6px',
                                        fontSize: '14px'
                                    }}
                                />
                            ) : (
                                <p style={{ color: '#333', fontSize: '16px' }}>₦{settings.delivery_fee || '0'}</p>
                            )}
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '4px', color: '#666', fontSize: '14px', fontWeight: '500' }}>
                                Tax Rate (%)
                            </label>
                            {editingSettings ? (
                                <input
                                    type="number"
                                    step="0.1"
                                    value={settingsForm.tax_rate || ''}
                                    onChange={(e) => setSettingsForm({ ...settingsForm, tax_rate: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #ddd',
                                        borderRadius: '6px',
                                        fontSize: '14px'
                                    }}
                                />
                            ) : (
                                <p style={{ color: '#333', fontSize: '16px' }}>{settings.tax_rate || '0'}%</p>
                            )}
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '4px', color: '#666', fontSize: '14px', fontWeight: '500' }}>
                                Commission Rate (%)
                            </label>
                            {editingSettings ? (
                                <input
                                    type="number"
                                    step="0.1"
                                    value={settingsForm.commission_rate || ''}
                                    onChange={(e) => setSettingsForm({ ...settingsForm, commission_rate: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #ddd',
                                        borderRadius: '6px',
                                        fontSize: '14px'
                                    }}
                                />
                            ) : (
                                <p style={{ color: '#333', fontSize: '16px' }}>{settings.commission_rate || '0'}%</p>
                            )}
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '4px', color: '#666', fontSize: '14px', fontWeight: '500' }}>
                                Minimum Order Amount (₦)
                            </label>
                            {editingSettings ? (
                                <input
                                    type="number"
                                    value={settingsForm.min_order_amount || ''}
                                    onChange={(e) => setSettingsForm({ ...settingsForm, min_order_amount: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #ddd',
                                        borderRadius: '6px',
                                        fontSize: '14px'
                                    }}
                                />
                            ) : (
                                <p style={{ color: '#333', fontSize: '16px' }}>₦{settings.min_order_amount || '0'}</p>
                            )}
                        </div>
                    </div>
                </div>

                <div>
                    <h4 style={{ marginBottom: '10px', color: '#555' }}>Contact Information</h4>
                    <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '4px', color: '#666', fontSize: '14px', fontWeight: '500' }}>
                                Support Email
                            </label>
                            {editingSettings ? (
                                <input
                                    type="email"
                                    value={settingsForm.support_email || ''}
                                    onChange={(e) => setSettingsForm({ ...settingsForm, support_email: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #ddd',
                                        borderRadius: '6px',
                                        fontSize: '14px'
                                    }}
                                />
                            ) : (
                                <p style={{ color: '#333', fontSize: '16px' }}>{settings.support_email || 'N/A'}</p>
                            )}
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '4px', color: '#666', fontSize: '14px', fontWeight: '500' }}>
                                Support Phone
                            </label>
                            {editingSettings ? (
                                <input
                                    type="tel"
                                    value={settingsForm.support_phone || ''}
                                    onChange={(e) => setSettingsForm({ ...settingsForm, support_phone: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #ddd',
                                        borderRadius: '6px',
                                        fontSize: '14px'
                                    }}
                                />
                            ) : (
                                <p style={{ color: '#333', fontSize: '16px' }}>{settings.support_phone || 'N/A'}</p>
                            )}
                        </div>
                    </div>
                </div>

                <div>
                    <h4 style={{ marginBottom: '10px', color: '#555' }}>Admin Information</h4>
                    <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                        <p style={{ color: '#666', marginBottom: '8px' }}>Email: {user?.email}</p>
                        <p style={{ color: '#666' }}>Role: Administrator</p>
                    </div>
                </div>
            </div>
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
                        Admin Dashboard
                    </h1>
                    <p style={{ color: '#666', fontSize: '14px' }}>Welcome, {user?.email}</p>
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
                            active={activeTab === 'vendors'}
                            onClick={() => setActiveTab('vendors')}
                            icon={<Users size={18} />}
                            label="Vendors"
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
                    {activeTab === 'vendors' && renderVendors()}
                    {activeTab === 'orders' && renderOrders()}
                    {activeTab === 'settings' && renderSettings()}
                </div>
            </div>

            {showVendorModal && (
                <VendorModal
                    vendor={editingVendor}
                    onClose={() => {
                        setShowVendorModal(false);
                        setEditingVendor(null);
                    }}
                    onSave={() => {
                        setShowVendorModal(false);
                        setEditingVendor(null);
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

const VendorModal = ({ vendor, onClose, onSave }: any) => {
    const [formData, setFormData] = useState({
        name: vendor?.name || '',
        email: vendor?.email || '',
        phone: vendor?.phone || '',
        description: vendor?.description || '',
        password: ''
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            if (vendor) {
                // Update existing vendor
                const { error: vendorError } = await supabase
                    .from('vendors')
                    .update({
                        name: formData.name,
                        email: formData.email,
                        phone: formData.phone,
                        description: formData.description
                    })
                    .eq('id', vendor.id);

                if (vendorError) throw vendorError;

                // Update user record
                const { error: userError } = await supabase
                    .from('users')
                    .update({
                        full_name: formData.name,
                        phone: formData.phone
                    })
                    .eq('id', vendor.owner_id);

                if (userError) throw userError;

                alert('Vendor updated successfully!');
            } else {
                // Create vendor account
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: formData.email,
                    password: formData.password,
                    options: {
                        data: {
                            role: 'vendor',
                            business_name: formData.name,
                            full_name: formData.name
                        }
                    }
                });

                if (authError) throw authError;

                if (authData.user) {
                    // Create user record
                    await supabase.from('users').insert({
                        id: authData.user.id,
                        email: formData.email,
                        role: 'vendor',
                        full_name: formData.name,
                        phone: formData.phone,
                        is_active: true
                    });

                    // Create vendor profile
                    await supabase.from('vendors').insert({
                        owner_id: authData.user.id,
                        name: formData.name,
                        email: formData.email,
                        phone: formData.phone,
                        description: formData.description,
                        is_active: true
                    });
                }

                alert('Vendor created successfully!');
            }

            onSave();
        } catch (error: any) {
            console.error('Error creating vendor:', error);
            alert(error.message || 'Failed to create vendor');
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
                    <h3 style={{ color: '#333' }}>{vendor ? 'Edit Vendor' : 'Add New Vendor'}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontSize: '24px' }}>×</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: '#555', fontWeight: '500' }}>
                            Business Name *
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: '#555', fontWeight: '500' }}>
                            Email *
                        </label>
                        <input
                            type="email"
                            required
                            disabled={!!vendor}
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', backgroundColor: vendor ? '#f3f4f6' : 'white' }}
                        />
                        {vendor && <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>Email cannot be changed</p>}
                    </div>

                    {!vendor && (
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', color: '#555', fontWeight: '500' }}>
                                Password *
                            </label>
                            <input
                                type="password"
                                required={!vendor}
                                minLength={6}
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
                            />
                        </div>
                    )}

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: '#555', fontWeight: '500' }}>
                            Phone
                        </label>
                        <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: '#555', fontWeight: '500' }}>
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', resize: 'vertical' }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{ flex: 1, padding: '12px', backgroundColor: '#f3f4f6', color: '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            style={{ flex: 1, padding: '12px', backgroundColor: '#ff6b35', color: 'white', border: 'none', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: '500', opacity: saving ? 0.7 : 1 }}
                        >
                            {saving ? 'Creating...' : 'Create Vendor'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminDashboard;
