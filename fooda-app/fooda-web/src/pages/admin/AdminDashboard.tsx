import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Vendor, Order } from '../../lib/types';
import { Users, ShoppingBag, Settings, TrendingUp, Clock, LogOut } from 'lucide-react';

type TabType = 'overview' | 'vendors' | 'orders' | 'customers' | 'analytics' | 'delivery' | 'settings';

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
    // Only show full-screen loader on the very first load.
    const initialLoad = useRef(true);
    const [showVendorModal, setShowVendorModal] = useState(false);
    const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
    const [settings, setSettings] = useState<any>({});
    const [editingSettings, setEditingSettings] = useState(false);
    const [settingsForm, setSettingsForm] = useState<any>({});
    const [customers, setCustomers] = useState<any[]>([]);
    const [deliveryPersons, setDeliveryPersons] = useState<any[]>([]);
    const [analyticsData, setAnalyticsData] = useState<{ dailyRevenue: {date: string; revenue: number; orders: number}[]; topVendors: {name: string; revenue: number; orders: number}[]; ordersByStatus: Record<string, number> }>({ dailyRevenue: [], topVendors: [], ordersByStatus: {} });
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const showConfirm = (message: string, onConfirm: () => void) => {
        setConfirmDialog({ message, onConfirm });
    };

    // Only initial fetch — token-refresh remounts are guarded against in
    // AuthContext (we never propagate a new user reference for the same id),
    // but keeping this effect with an empty dep array adds belt-and-suspenders.
    useEffect(() => {
        fetchData();
    }, [user?.id]);

    useEffect(() => {
        if (activeTab === 'customers') fetchCustomers();
        if (activeTab === 'delivery') fetchDeliveryPersons();
        if (activeTab === 'analytics') buildAnalytics();
    }, [activeTab]);


    const fetchData = async () => {
        if (initialLoad.current) setLoading(true);
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
            initialLoad.current = false;
        }
    };

    const fetchCustomers = async () => {
        const { data } = await supabase
            .from('users')
            .select('id, email, full_name, phone, is_active, created_at, role')
            .eq('role', 'customer')
            .order('created_at', { ascending: false });
        if (!data) return;
        // Fetch order counts
        const ids = data.map(u => u.id);
        const { data: orderSums } = await supabase
            .from('orders')
            .select('customer_id, total_amount')
            .in('customer_id', ids);
        const byCustomer: Record<string, { count: number; spent: number }> = {};
        (orderSums ?? []).forEach(o => {
            if (!byCustomer[o.customer_id]) byCustomer[o.customer_id] = { count: 0, spent: 0 };
            byCustomer[o.customer_id].count++;
            byCustomer[o.customer_id].spent += Number(o.total_amount);
        });
        setCustomers(data.map(u => ({ ...u, orderCount: byCustomer[u.id]?.count ?? 0, totalSpent: byCustomer[u.id]?.spent ?? 0 })));
    };

    const fetchDeliveryPersons = async () => {
        const { data } = await supabase
            .from('users')
            .select('id, email, full_name, phone, is_active, created_at')
            .eq('role', 'delivery_person')
            .order('created_at', { ascending: false });
        setDeliveryPersons(data ?? []);
    };

    const buildAnalytics = async () => {
        // Last 30 days of orders
        const since = new Date(); since.setDate(since.getDate() - 29);
        const { data: recentOrders } = await supabase
            .from('orders')
            .select('id, created_at, total_amount, status, payment_status, vendor_id, vendors!orders_vendor_id_fkey(name)')
            .gte('created_at', since.toISOString())
            .order('created_at');

        const all = recentOrders ?? [];

        // Daily revenue map
        const dailyMap: Record<string, { revenue: number; orders: number }> = {};
        for (let i = 0; i < 30; i++) {
            const d = new Date(since); d.setDate(d.getDate() + i);
            dailyMap[d.toISOString().slice(0, 10)] = { revenue: 0, orders: 0 };
        }
        all.forEach(o => {
            const day = o.created_at.slice(0, 10);
            if (dailyMap[day]) {
                dailyMap[day].orders++;
                if (o.payment_status === 'completed') dailyMap[day].revenue += Number(o.total_amount);
            }
        });
        const dailyRevenue = Object.entries(dailyMap).map(([date, v]) => ({ date, ...v }));

        // Orders by status
        const ordersByStatus: Record<string, number> = {};
        all.forEach(o => { ordersByStatus[o.status] = (ordersByStatus[o.status] ?? 0) + 1; });

        // Top vendors
        const vendorMap: Record<string, { name: string; revenue: number; orders: number }> = {};
        all.forEach((o: any) => {
            const vid = o.vendor_id;
            const name = Array.isArray(o.vendors) ? o.vendors[0]?.name : o.vendors?.name ?? vid;
            if (!vendorMap[vid]) vendorMap[vid] = { name, revenue: 0, orders: 0 };
            vendorMap[vid].orders++;
            if (o.payment_status === 'completed') vendorMap[vid].revenue += Number(o.total_amount);
        });
        const topVendors = Object.values(vendorMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

        setAnalyticsData({ dailyRevenue, topVendors, ordersByStatus });
    };

    const toggleCustomerStatus = async (userId: string, current: boolean) => {
        await supabase.from('users').update({ is_active: !current }).eq('id', userId);
        setCustomers(prev => prev.map(c => c.id === userId ? { ...c, is_active: !current } : c));
    };

    const toggleDeliveryStatus = async (userId: string, current: boolean) => {
        await supabase.from('users').update({ is_active: !current }).eq('id', userId);
        setDeliveryPersons(prev => prev.map(d => d.id === userId ? { ...d, is_active: !current } : d));
    };

    const renderCustomers = () => (
        <div style={{ background: '#fff', padding: 24, borderRadius: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ color: '#333', margin: 0 }}>Customer Management</h3>
                <span style={{ fontSize: 13, color: '#888' }}>{customers.length} total customers</span>
            </div>
            {customers.length === 0 ? (
                <p style={{ color: '#999', textAlign: 'center', padding: 40 }}>No customers yet</p>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #eee' }}>
                                {['Name', 'Email', 'Phone', 'Orders', 'Total Spent', 'Status', 'Actions'].map(h => (
                                    <th key={h} style={{ padding: '12px', textAlign: 'left', fontSize: 13, color: '#666', fontWeight: 600 }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {customers.map(c => (
                                <tr key={c.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                    <td style={{ padding: '12px', fontSize: 14 }}>{c.full_name || '—'}</td>
                                    <td style={{ padding: '12px', fontSize: 14 }}>{c.email}</td>
                                    <td style={{ padding: '12px', fontSize: 14 }}>{c.phone || '—'}</td>
                                    <td style={{ padding: '12px', fontSize: 14, textAlign: 'center' }}>{c.orderCount}</td>
                                    <td style={{ padding: '12px', fontSize: 14 }}>₦{c.totalSpent.toLocaleString()}</td>
                                    <td style={{ padding: '12px' }}>
                                        <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: c.is_active ? '#dcfce7' : '#fee2e2', color: c.is_active ? '#16a34a' : '#dc2626' }}>
                                            {c.is_active ? 'Active' : 'Suspended'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        <button onClick={() => toggleCustomerStatus(c.id, c.is_active)} style={{ padding: '5px 12px', background: c.is_active ? '#fee2e2' : '#dcfce7', color: c.is_active ? '#dc2626' : '#16a34a', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                                            {c.is_active ? 'Suspend' : 'Activate'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

    const renderDelivery = () => (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ color: '#333', margin: 0 }}>Delivery Personnel</h3>
                <button onClick={() => setShowDeliveryModal(true)} style={{ padding: '10px 20px', background: '#ff6b35', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                    + Add Driver
                </button>
            </div>
            <div style={{ background: '#fff', padding: 24, borderRadius: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
                {deliveryPersons.length === 0 ? (
                    <p style={{ color: '#999', textAlign: 'center', padding: 40 }}>No delivery personnel added yet</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #eee' }}>
                                    {['Name', 'Email', 'Phone', 'Status', 'Joined', 'Actions'].map(h => (
                                        <th key={h} style={{ padding: '12px', textAlign: 'left', fontSize: 13, color: '#666', fontWeight: 600 }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {deliveryPersons.map(d => (
                                    <tr key={d.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                        <td style={{ padding: '12px', fontSize: 14 }}>{d.full_name || '—'}</td>
                                        <td style={{ padding: '12px', fontSize: 14 }}>{d.email}</td>
                                        <td style={{ padding: '12px', fontSize: 14 }}>{d.phone || '—'}</td>
                                        <td style={{ padding: '12px' }}>
                                            <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: d.is_active ? '#dcfce7' : '#fee2e2', color: d.is_active ? '#16a34a' : '#dc2626' }}>
                                                {d.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', fontSize: 13, color: '#888' }}>{new Date(d.created_at).toLocaleDateString()}</td>
                                        <td style={{ padding: '12px' }}>
                                            <button onClick={() => toggleDeliveryStatus(d.id, d.is_active)} style={{ padding: '5px 12px', background: d.is_active ? '#fee2e2' : '#dcfce7', color: d.is_active ? '#dc2626' : '#16a34a', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                                                {d.is_active ? 'Deactivate' : 'Activate'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );

    const renderAnalytics = () => {
        const maxRevenue = Math.max(...analyticsData.dailyRevenue.map(d => d.revenue), 1);
        const totalRevenue30 = analyticsData.dailyRevenue.reduce((s, d) => s + d.revenue, 0);
        const totalOrders30 = analyticsData.dailyRevenue.reduce((s, d) => s + d.orders, 0);
        const statusColors: Record<string, string> = { pending: '#f59e0b', confirmed: '#3b82f6', preparing: '#8b5cf6', ready_for_pickup: '#06b6d4', picked_up: '#ff6b35', delivered: '#16a34a', cancelled: '#ef4444' };
        const totalStatusOrders = Object.values(analyticsData.ordersByStatus).reduce((s, v) => s + v, 0) || 1;

        return (
            <div>
                {/* 30-day summary cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
                    {[
                        { label: '30-Day Revenue', value: `₦${totalRevenue30.toLocaleString()}`, icon: '💰', color: '#16a34a' },
                        { label: '30-Day Orders', value: totalOrders30, icon: '📦', color: '#3b82f6' },
                        { label: 'Avg Order Value', value: totalOrders30 ? `₦${Math.round(totalRevenue30 / totalOrders30).toLocaleString()}` : '—', icon: '📊', color: '#8b5cf6' },
                        { label: 'Top Vendor', value: analyticsData.topVendors[0]?.name ?? '—', icon: '🏆', color: '#ff6b35' },
                    ].map(({ label, value, icon, color }) => (
                        <div key={label} style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
                            <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
                            <p style={{ margin: 0, fontSize: 13, color: '#888' }}>{label}</p>
                            <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color }}>{value}</p>
                        </div>
                    ))}
                </div>

                {/* Revenue bar chart */}
                <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', marginBottom: 24 }}>
                    <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: '#333' }}>Daily Revenue — Last 30 Days</h3>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 140, overflowX: 'auto', paddingBottom: 8 }}>
                        {analyticsData.dailyRevenue.map(d => (
                            <div key={d.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 20, flex: 1 }} title={`${d.date}: ₦${d.revenue.toLocaleString()} (${d.orders} orders)`}>
                                <div style={{ width: '100%', background: d.revenue > 0 ? '#ff6b35' : '#f0f0f0', borderRadius: '3px 3px 0 0', height: `${Math.max((d.revenue / maxRevenue) * 120, d.revenue > 0 ? 4 : 0)}px`, transition: 'height 0.3s' }} />
                                <span style={{ fontSize: 8, color: '#ccc', marginTop: 4, transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>{d.date.slice(5)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    {/* Orders by status */}
                    <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#333' }}>Orders by Status (30d)</h3>
                        {Object.entries(analyticsData.ordersByStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
                            <div key={status} style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                                    <span style={{ color: '#555', textTransform: 'capitalize' }}>{status.replace(/_/g, ' ')}</span>
                                    <span style={{ fontWeight: 700 }}>{count}</span>
                                </div>
                                <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', background: statusColors[status] ?? '#888', borderRadius: 4, width: `${(count / totalStatusOrders) * 100}%`, transition: 'width 0.4s' }} />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Top vendors */}
                    <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#333' }}>Top Vendors by Revenue (30d)</h3>
                        {analyticsData.topVendors.length === 0 ? (
                            <p style={{ color: '#aaa', fontSize: 14 }}>No data yet</p>
                        ) : analyticsData.topVendors.map((v, i) => (
                            <div key={v.name} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                                <span style={{ width: 24, height: 24, borderRadius: '50%', background: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</p>
                                    <p style={{ margin: 0, fontSize: 12, color: '#888' }}>{v.orders} orders</p>
                                </div>
                                <span style={{ fontWeight: 700, fontSize: 14, color: '#ff6b35', flexShrink: 0 }}>₦{v.revenue.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const handleLogout = async () => {
        await signOut();
        navigate('/auth');
    };

    const toggleVendorStatus = async (vendorId: string, ownerId: string, currentStatus: boolean) => {
        try {
            const { error: vendorError } = await supabase.from('vendors').update({ is_active: !currentStatus }).eq('id', vendorId);
            if (vendorError) throw vendorError;
            const { error: userError } = await supabase.from('users').update({ is_active: !currentStatus }).eq('id', ownerId);
            if (userError) throw userError;
            showToast(`Vendor ${!currentStatus ? 'activated' : 'deactivated'}`);
            fetchData();
        } catch (error: any) {
            showToast(error.message || 'Failed to update vendor status', 'error');
        }
    };


    const deleteVendor = (vendorId: string, ownerId: string, vendorName: string) => {
        showConfirm(
            `Delete "${vendorName}"? This will also delete all menu items and cannot be undone.`,
            async () => {
                try {
                    const { error: e1 } = await supabase.from('menu_items').delete().eq('vendor_id', vendorId);
                    if (e1) throw new Error(`Failed to delete menu items: ${e1.message}`);
                    const { error: e2 } = await supabase.from('menu_categories').delete().eq('vendor_id', vendorId);
                    if (e2) throw new Error(`Failed to delete categories: ${e2.message}`);
                    const { error: e3 } = await supabase.from('vendors').delete().eq('id', vendorId);
                    if (e3) throw new Error(`Failed to delete vendor: ${e3.message}`);
                    const { error: e4 } = await supabase.from('users').delete().eq('id', ownerId);
                    if (e4) throw new Error(`Failed to delete user: ${e4.message}`);
                    showToast('Vendor deleted successfully');
                    await fetchData();
                } catch (err: any) {
                    showToast(err.message || 'Failed to delete vendor', 'error');
                }
            }
        );
    };


    const updateOrderStatus = async (orderId: string, newStatus: string) => {
        const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
        if (error) { showToast('Failed to update order status', 'error'); return; }
        fetchData();
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
            await Promise.all(
                Object.keys(settingsForm).map(key =>
                    supabase.from('platform_settings').update({ setting_value: settingsForm[key] }).eq('setting_key', key)
                )
            );
            setSettings(settingsForm);
            setEditingSettings(false);
            showToast('Settings saved');
        } catch (error: any) {
            showToast(error.message || 'Failed to save settings', 'error');
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, fontSize: '1.3rem', fontWeight: 800, color: '#ff6b35', letterSpacing: '-0.5px', flexShrink: 0 }}>
                        🍴 Fooda
                    </Link>
                    <div style={{ width: 1, height: 28, background: '#e5e7eb' }} />
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <h1 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#333', marginBottom: 0 }}>
                                Admin Dashboard
                            </h1>
                            <span style={{ background: '#fef2f2', color: '#dc2626', fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase' }}>
                                Admin
                            </span>
                        </div>
                        <p style={{ color: '#666', fontSize: '13px', marginTop: 2 }}>{user?.email}</p>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    title="Sign out"
                    aria-label="Sign out"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '9px 14px',
                        backgroundColor: '#fff',
                        color: '#dc2626',
                        border: '1px solid #fee2e2',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '13px',
                    }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLButtonElement; el.style.background = '#fef2f2'; el.style.borderColor = '#fecaca'; }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLButtonElement; el.style.background = '#fff'; el.style.borderColor = '#fee2e2'; }}
                >
                    <LogOut size={16} /> Sign out
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
                            active={activeTab === 'analytics'}
                            onClick={() => setActiveTab('analytics')}
                            icon={<TrendingUp size={18} />}
                            label="Analytics"
                        />
                        <TabButton
                            active={activeTab === 'customers'}
                            onClick={() => setActiveTab('customers')}
                            icon={<Users size={18} />}
                            label="Customers"
                        />
                        <TabButton
                            active={activeTab === 'delivery'}
                            onClick={() => setActiveTab('delivery')}
                            icon={<ShoppingBag size={18} />}
                            label="Delivery"
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
                    {activeTab === 'analytics' && renderAnalytics()}
                    {activeTab === 'customers' && renderCustomers()}
                    {activeTab === 'delivery' && renderDelivery()}
                    {activeTab === 'settings' && renderSettings()}
                </div>
            </div>

            {showVendorModal && (
                <VendorModal
                    vendor={editingVendor}
                    onClose={() => { setShowVendorModal(false); setEditingVendor(null); }}
                    onSave={() => { setShowVendorModal(false); setEditingVendor(null); fetchData(); }}
                />
            )}

            {showDeliveryModal && (
                <DeliveryPersonModal
                    onClose={() => setShowDeliveryModal(false)}
                    onSave={() => { setShowDeliveryModal(false); fetchDeliveryPersons(); }}
                />
            )}

            {/* Toast notification */}
            {toast && (
                <div style={{ position: 'fixed', bottom: 28, right: 28, padding: '12px 20px', borderRadius: 10, background: toast.type === 'error' ? '#dc2626' : '#16a34a', color: '#fff', fontWeight: 600, fontSize: 14, zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', maxWidth: 340 }}>
                    {toast.msg}
                </div>
            )}

            {/* Confirm dialog */}
            {confirmDialog && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998, padding: 24 }}>
                    <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 400, width: '100%', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
                        <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
                        <p style={{ fontSize: 15, color: '#333', margin: '0 0 24px', lineHeight: 1.5 }}>{confirmDialog.message}</p>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button onClick={() => setConfirmDialog(null)} style={{ flex: 1, padding: '10px 0', border: '1px solid #ddd', borderRadius: 10, background: '#fff', cursor: 'pointer', fontWeight: 500 }}>
                                Cancel
                            </button>
                            <button
                                onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
                                style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: 10, background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: 700 }}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
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
    const [error, setError] = useState('');

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

                onSave();
                return;
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

            }

            onSave();
        } catch (error: any) {
            setError(error.message || 'Failed to save vendor');
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
                    {error && <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>{error}</div>}
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

const DeliveryPersonModal = ({ onClose, onSave }: { onClose: () => void; onSave: () => void }) => {
    const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true); setError('');
        try {
            const { data: authData, error: authErr } = await supabase.auth.signUp({
                email: form.email,
                password: form.password,
                options: { data: { role: 'delivery_person', full_name: form.full_name } },
            });
            if (authErr) throw authErr;
            if (authData.user) {
                await supabase.from('users').insert({
                    id: authData.user.id,
                    email: form.email,
                    role: 'delivery_person',
                    full_name: form.full_name,
                    phone: form.phone,
                    is_active: true,
                });
            }
            onSave();
        } catch (err: any) {
            setError(err.message ?? 'Failed to create account');
            setSaving(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 440, width: '90%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ margin: 0 }}>Add Delivery Driver</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: '#666' }}>×</button>
                </div>
                {error && <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>{error}</div>}
                <form onSubmit={handleSubmit}>
                    {[
                        { label: 'Full Name *', key: 'full_name', type: 'text' },
                        { label: 'Email *', key: 'email', type: 'email' },
                        { label: 'Phone', key: 'phone', type: 'tel' },
                        { label: 'Password *', key: 'password', type: 'password' },
                    ].map(({ label, key, type }) => (
                        <div key={key} style={{ marginBottom: 14 }}>
                            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#444' }}>{label}</label>
                            <input type={type} required={label.includes('*')} minLength={key === 'password' ? 6 : undefined} value={(form as any)[key]} onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' as const }} />
                        </div>
                    ))}
                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                        <button type="button" onClick={onClose} style={{ flex: 1, padding: '11px 0', border: '1px solid #ddd', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>Cancel</button>
                        <button type="submit" disabled={saving} style={{ flex: 1, padding: '11px 0', border: 'none', borderRadius: 8, background: '#ff6b35', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
                            {saving ? 'Creating…' : 'Add Driver'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminDashboard;
