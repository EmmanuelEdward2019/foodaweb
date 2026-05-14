import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Vendor, MenuItem, MenuCategory, Order } from '../../lib/types';
import {
    Plus, Edit2, Trash2, ShoppingBag, Settings, TrendingUp, X,
    Bell, BarChart2, Tag, RefreshCw, CheckCircle, ChevronDown, ChevronUp,
    Search, Upload, Image as ImageIcon, Zap, LogOut,
} from 'lucide-react';

type TabType = 'overview' | 'menu' | 'categories' | 'orders' | 'analytics' | 'settings';
type OrderFilter = 'all' | 'pending' | 'active' | 'done' | 'cancelled';

const ORDER_FILTER_MAP: Record<OrderFilter, string[]> = {
    all:       [],
    pending:   ['pending'],
    active:    ['confirmed', 'preparing', 'ready_for_pickup', 'picked_up'],
    done:      ['delivered'],
    cancelled: ['cancelled'],
};

const badge = (status: string) => {
    const map: Record<string, { bg: string; color: string }> = {
        pending:          { bg: '#fef3c7', color: '#d97706' },
        confirmed:        { bg: '#dbeafe', color: '#2563eb' },
        preparing:        { bg: '#fce7f3', color: '#db2777' },
        ready_for_pickup: { bg: '#e0e7ff', color: '#6366f1' },
        picked_up:        { bg: '#ddd6fe', color: '#7c3aed' },
        delivered:        { bg: '#dcfce7', color: '#16a34a' },
        cancelled:        { bg: '#fee2e2', color: '#dc2626' },
    };
    const s = map[status] || map.pending;
    return (
        <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '500', backgroundColor: s.bg, color: s.color }}>
            {status.replace(/_/g, ' ')}
        </span>
    );
};

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px', border: '1px solid #ddd',
    borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box',
};

// ─── Upload image to Supabase Storage ───────────────────────────────────────
async function uploadMenuImage(file: File, vendorId: string): Promise<string> {
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${vendorId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('menu-images').upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from('menu-images').getPublicUrl(path);
    return data.publicUrl;
}

// ─── Main Component ──────────────────────────────────────────────────────────
const VendorDashboard = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<MenuCategory[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [stats, setStats] = useState({ todayOrders: 0, pendingOrders: 0, todayRevenue: 0, totalMenuItems: 0 });
    const [loading, setLoading] = useState(true);
    const [showMenuModal, setShowMenuModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
    const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const realtimeRef = useRef<any>(null);

    // Orders
    const [orderFilter, setOrderFilter] = useState<OrderFilter>('all');
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [orderItemsMap, setOrderItemsMap] = useState<Record<string, any[]>>({});

    // Menu
    const [menuSearch, setMenuSearch] = useState('');
    const [menuCatFilter, setMenuCatFilter] = useState('');

    // Analytics
    const [topItems, setTopItems] = useState<{ name: string; count: number; revenue: number }[]>([]);

    useEffect(() => { if (user) fetchData(); }, [user]);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const fetchData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data: existingUser } = await supabase.from('users').select('id').eq('id', user.id).maybeSingle();
            if (!existingUser) {
                await supabase.from('users').insert({
                    id: user.id, email: user.email,
                    role: user.user_metadata?.role || 'vendor',
                    full_name: user.user_metadata?.business_name || user.user_metadata?.full_name || user.email?.split('@')[0],
                    is_active: true,
                });
            }

            let { data: vendorData } = await supabase.from('vendors').select('*').eq('owner_id', user.id).maybeSingle();
            if (!vendorData) {
                const { data: newV } = await supabase.from('vendors').insert({
                    owner_id: user.id,
                    name: user.user_metadata?.business_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'My Restaurant',
                    email: user.email, is_active: true,
                }).select().single();
                vendorData = newV;
            }
            if (!vendorData) throw new Error('No vendor profile');
            setVendor(vendorData);

            const [menuRes, catRes, ordersRes, notifRes] = await Promise.all([
                supabase.from('menu_items').select('*').eq('vendor_id', vendorData.id).order('sort_order'),
                supabase.from('menu_categories').select('*').eq('vendor_id', vendorData.id).order('sort_order'),
                supabase.from('orders').select('*, delivery_address').eq('vendor_id', vendorData.id).order('created_at', { ascending: false }).limit(200),
                supabase.from('notifications').select('*').eq('vendor_id', vendorData.id).order('created_at', { ascending: false }).limit(50),
            ]);

            const items  = menuRes.data   || [];
            const cats   = catRes.data    || [];
            const ords   = ordersRes.data || [];
            const notifs = notifRes.data  || [];

            setMenuItems(items);
            setCategories(cats);
            setOrders(ords);
            setNotifications(notifs);
            setUnreadCount(notifs.filter((n: any) => !n.is_read).length);

            const today = new Date().toISOString().split('T')[0];
            setStats({
                todayOrders:    ords.filter(o => o.created_at.startsWith(today)).length,
                pendingOrders:  ords.filter(o => ['pending', 'confirmed'].includes(o.status)).length,
                todayRevenue:   ords.filter(o => o.created_at.startsWith(today) && o.payment_status === 'completed').reduce((s, o) => s + Number(o.total_amount), 0),
                totalMenuItems: items.length,
            });

            if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);
            realtimeRef.current = supabase.channel(`vendor-orders-${vendorData.id}`)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `vendor_id=eq.${vendorData.id}` }, (payload) => {
                    setOrders(prev => [payload.new as Order, ...prev]);
                    setStats(prev => ({ ...prev, pendingOrders: prev.pendingOrders + 1, todayOrders: prev.todayOrders + 1 }));
                    showToast('New order received!', 'success');
                })
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `vendor_id=eq.${vendorData.id}` }, (payload) => {
                    setOrders(prev => prev.map(o => o.id === (payload.new as Order).id ? payload.new as Order : o));
                })
                .subscribe();
        } catch (err: any) {
            console.error(err);
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => () => { if (realtimeRef.current) supabase.removeChannel(realtimeRef.current); }, []);

    // Lazy-load top items when analytics tab opens
    useEffect(() => {
        if (activeTab !== 'analytics' || topItems.length > 0 || orders.length === 0) return;
        const orderIds = orders.map(o => o.id).slice(0, 200);
        supabase.from('order_items')
            .select('menu_item_id, quantity, total_price, menu_items(name)')
            .in('order_id', orderIds)
            .then(({ data }) => {
                if (!data) return;
                const map: Record<string, { name: string; count: number; revenue: number }> = {};
                data.forEach((row: any) => {
                    const id   = row.menu_item_id;
                    const name = row.menu_items?.name || 'Unknown';
                    if (!map[id]) map[id] = { name, count: 0, revenue: 0 };
                    map[id].count   += row.quantity;
                    map[id].revenue += Number(row.total_price);
                });
                setTopItems(Object.values(map).sort((a, b) => b.count - a.count).slice(0, 8));
            });
    }, [activeTab, orders]);

    const updateOrderStatus = async (orderId: string, newStatus: string) => {
        const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
        if (error) { showToast('Failed to update order', 'error'); return; }
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus as Order['status'] } : o));
        showToast('Order updated');
    };

    const expandOrder = async (orderId: string) => {
        if (expandedOrderId === orderId) { setExpandedOrderId(null); return; }
        setExpandedOrderId(orderId);
        if (orderItemsMap[orderId]) return;
        const { data } = await supabase
            .from('order_items')
            .select('id, quantity, price_per_unit, total_price, special_instructions, menu_items(name, image_url)')
            .eq('order_id', orderId);
        setOrderItemsMap(prev => ({ ...prev, [orderId]: data || [] }));
    };

    const markNotificationsRead = async () => {
        if (!vendor) return;
        await supabase.from('notifications').update({ is_read: true }).eq('vendor_id', vendor.id).eq('is_read', false);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
    };

    // ── Overview ──────────────────────────────────────────────────────────────
    const renderOverview = () => {
        const avgOrderValue = orders.length > 0
            ? orders.filter(o => o.payment_status === 'completed').reduce((s, o) => s + Number(o.total_amount), 0) / Math.max(orders.filter(o => o.payment_status === 'completed').length, 1)
            : 0;

        return (
            <div>
                {/* Stats cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '20px', marginBottom: '28px' }}>
                    {[
                        { icon: <ShoppingBag size={22} />, title: "Today's Orders",   value: stats.todayOrders,                         sub: 'Orders received today',  color: '#ff6b35' },
                        { icon: <Bell size={22} />,        title: 'Pending Orders',    value: stats.pendingOrders,                        sub: 'Awaiting action',        color: '#FF9800' },
                        { icon: <TrendingUp size={22} />,  title: "Today's Revenue",   value: `₦${stats.todayRevenue.toLocaleString()}`,  sub: 'Completed payments',     color: '#4CAF50' },
                        { icon: <ShoppingBag size={22} />, title: 'Avg Order Value',   value: `₦${Math.round(avgOrderValue).toLocaleString()}`, sub: 'Per completed order', color: '#2196F3' },
                    ].map(c => (
                        <div key={c.title} style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,.08)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                                <span style={{ color: c.color, marginRight: '12px' }}>{c.icon}</span>
                                <span style={{ fontSize: '13px', color: '#666', fontWeight: '500' }}>{c.title}</span>
                            </div>
                            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>{c.value}</p>
                            <p style={{ fontSize: '12px', color: '#999' }}>{c.sub}</p>
                        </div>
                    ))}
                </div>

                {/* Quick Actions */}
                <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,.08)', marginBottom: '24px' }}>
                    <h3 style={{ color: '#333', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: 8 }}><Zap size={18} color="#ff6b35" /> Quick Actions</h3>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {[
                            { label: '+ Add Menu Item',    tab: 'menu',       action: () => { setActiveTab('menu');       setTimeout(() => { setEditingItem(null); setShowMenuModal(true); }, 50); } },
                            { label: '+ Add Category',     tab: 'categories', action: () => { setActiveTab('categories'); setTimeout(() => { setEditingCategory(null); setShowCategoryModal(true); }, 50); } },
                            { label: 'View Pending Orders', tab: 'orders',    action: () => { setActiveTab('orders');     setOrderFilter('pending'); } },
                            { label: 'View Analytics',     tab: 'analytics',  action: () => setActiveTab('analytics') },
                        ].map(q => (
                            <button key={q.label} onClick={q.action}
                                style={{ padding: '10px 18px', background: '#fff7ed', color: '#ff6b35', border: '1px solid #fed7aa', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
                                {q.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Notifications */}
                {notifications.length > 0 && (
                    <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,.08)', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Bell size={18} /> Notifications
                                {unreadCount > 0 && <span style={{ background: '#ff6b35', color: '#fff', borderRadius: '10px', padding: '2px 8px', fontSize: '12px' }}>{unreadCount}</span>}
                            </h3>
                            {unreadCount > 0 && <button onClick={markNotificationsRead} style={{ background: 'none', border: 'none', color: '#ff6b35', cursor: 'pointer', fontSize: '13px' }}>Mark all read</button>}
                        </div>
                        {notifications.slice(0, 5).map(n => (
                            <div key={n.id} style={{ padding: '12px', borderRadius: '8px', marginBottom: '8px', background: n.is_read ? '#f9fafb' : '#fff7ed', borderLeft: n.is_read ? '3px solid #e5e7eb' : '3px solid #ff6b35' }}>
                                <p style={{ fontWeight: '500', color: '#333', marginBottom: '2px', fontSize: '14px' }}>{n.title}</p>
                                <p style={{ color: '#666', fontSize: '13px' }}>{n.message}</p>
                                <p style={{ color: '#aaa', fontSize: '11px', marginTop: '4px' }}>{new Date(n.created_at).toLocaleString()}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Recent orders */}
                <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ color: '#333' }}>Recent Orders</h3>
                        <button onClick={() => setActiveTab('orders')} style={{ background: 'none', border: 'none', color: '#ff6b35', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>View all →</button>
                    </div>
                    {orders.slice(0, 5).length > 0 ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead><tr style={{ borderBottom: '2px solid #eee' }}>
                                {['Order #', 'Status', 'Amount', 'Date'].map(h => <th key={h} style={{ padding: '10px', textAlign: 'left', color: '#555', fontSize: '13px' }}>{h}</th>)}
                            </tr></thead>
                            <tbody>
                                {orders.slice(0, 5).map(o => (
                                    <tr key={o.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                        <td style={{ padding: '10px', fontSize: '14px', fontWeight: '500' }}>{o.order_number}</td>
                                        <td style={{ padding: '10px' }}>{badge(o.status)}</td>
                                        <td style={{ padding: '10px', color: '#333' }}>₦{Number(o.total_amount).toLocaleString()}</td>
                                        <td style={{ padding: '10px', color: '#666', fontSize: '13px' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>No orders yet</p>}
                </div>
            </div>
        );
    };

    // ── Menu Items ────────────────────────────────────────────────────────────
    const renderMenu = () => {
        const filtered = menuItems.filter(item => {
            const matchSearch = !menuSearch || item.name.toLowerCase().includes(menuSearch.toLowerCase()) || (item.description || '').toLowerCase().includes(menuSearch.toLowerCase());
            const matchCat    = !menuCatFilter || item.category_id === menuCatFilter;
            return matchSearch && matchCat;
        });

        return (
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ color: '#333' }}>Menu Items ({menuItems.length})</h3>
                    <button onClick={() => { setEditingItem(null); setShowMenuModal(true); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#ff6b35', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>
                        <Plus size={16} /> Add Item
                    </button>
                </div>

                {/* Search + filter */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
                        <input
                            placeholder="Search items…"
                            value={menuSearch}
                            onChange={e => setMenuSearch(e.target.value)}
                            style={{ ...inputStyle, paddingLeft: '34px' }}
                        />
                    </div>
                    <select value={menuCatFilter} onChange={e => setMenuCatFilter(e.target.value)}
                        style={{ ...inputStyle, width: 'auto', minWidth: '160px' }}>
                        <option value="">All categories</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,.08)' }}>
                    {filtered.length > 0 ? (
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {filtered.map(item => {
                                const cat = categories.find(c => c.id === item.category_id);
                                return (
                                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', border: '1px solid #e5e7eb', borderRadius: '10px', gap: 12 }}>
                                        {/* Thumbnail */}
                                        <div style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {item.image_url
                                                ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                                : <ImageIcon size={22} color="#ccc" />
                                            }
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                                <h4 style={{ color: '#333', margin: 0 }}>{item.name}</h4>
                                                {cat && <span style={{ padding: '2px 8px', background: '#e0e7ff', color: '#4f46e5', borderRadius: '8px', fontSize: '11px' }}>{cat.name}</span>}
                                                {item.is_vegetarian && <span style={{ padding: '2px 6px', background: '#dcfce7', color: '#16a34a', borderRadius: '8px', fontSize: '11px' }}>Veg</span>}
                                            </div>
                                            <p style={{ color: '#666', fontSize: '13px', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>{item.description || 'No description'}</p>
                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                <span style={{ fontWeight: 'bold', color: '#ff6b35' }}>₦{Number(item.price).toLocaleString()}</span>
                                                {item.prep_time && <span style={{ fontSize: '12px', color: '#666' }}>~{item.prep_time}min</span>}
                                                <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '12px', background: item.is_available ? '#dcfce7' : '#fee2e2', color: item.is_available ? '#16a34a' : '#dc2626' }}>
                                                    {item.is_available ? 'Available' : 'Unavailable'}
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                            <button
                                                onClick={() => supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id).then(() => fetchData())}
                                                style={{ padding: '7px 12px', background: item.is_available ? '#fef3c7' : '#dcfce7', color: item.is_available ? '#d97706' : '#16a34a', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                                                {item.is_available ? 'Disable' : 'Enable'}
                                            </button>
                                            <button onClick={() => { setEditingItem(item); setShowMenuModal(true); }} style={{ padding: '8px', background: '#e0e7ff', color: '#4f46e5', border: 'none', borderRadius: '6px', cursor: 'pointer' }}><Edit2 size={15} /></button>
                                            <button onClick={async () => {
                                                if (!confirm('Delete this item?')) return;
                                                await supabase.from('menu_items').delete().eq('id', item.id);
                                                fetchData(); showToast('Item deleted');
                                            }} style={{ padding: '8px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', cursor: 'pointer' }}><Trash2 size={15} /></button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p style={{ color: '#999', textAlign: 'center', padding: '40px' }}>
                            {menuItems.length === 0 ? 'No menu items yet. Click "Add Item" to start.' : 'No items match your search.'}
                        </p>
                    )}
                </div>
            </div>
        );
    };

    // ── Categories ────────────────────────────────────────────────────────────
    const renderCategories = () => (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ color: '#333' }}>Menu Categories ({categories.length})</h3>
                <button onClick={() => { setEditingCategory(null); setShowCategoryModal(true); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#ff6b35', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>
                    <Plus size={16} /> Add Category
                </button>
            </div>
            <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,.08)' }}>
                {categories.length > 0 ? (
                    <div style={{ display: 'grid', gap: '12px' }}>
                        {categories.map(cat => {
                            const count = menuItems.filter(m => m.category_id === cat.id).length;
                            return (
                                <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <Tag size={16} color="#ff6b35" />
                                            <h4 style={{ color: '#333', margin: 0 }}>{cat.name}</h4>
                                            <span style={{ background: '#f3f4f6', color: '#666', padding: '2px 8px', borderRadius: '8px', fontSize: '12px' }}>{count} items</span>
                                            <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '12px', background: cat.is_active ? '#dcfce7' : '#fee2e2', color: cat.is_active ? '#16a34a' : '#dc2626' }}>
                                                {cat.is_active ? 'Active' : 'Hidden'}
                                            </span>
                                        </div>
                                        {cat.description && <p style={{ color: '#666', fontSize: '13px', marginTop: '4px' }}>{cat.description}</p>}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => { setEditingCategory(cat); setShowCategoryModal(true); }} style={{ padding: '8px', background: '#e0e7ff', color: '#4f46e5', border: 'none', borderRadius: '6px', cursor: 'pointer' }}><Edit2 size={15} /></button>
                                        <button onClick={async () => {
                                            if (count > 0 && !confirm(`This category has ${count} items. They will become uncategorised. Continue?`)) return;
                                            await supabase.from('menu_categories').delete().eq('id', cat.id);
                                            fetchData(); showToast('Category deleted');
                                        }} style={{ padding: '8px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', cursor: 'pointer' }}><Trash2 size={15} /></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : <p style={{ color: '#999', textAlign: 'center', padding: '40px' }}>No categories yet. Create categories to organise your menu.</p>}
            </div>
        </div>
    );

    // ── Orders ────────────────────────────────────────────────────────────────
    const renderOrders = () => {
        const nextStatus: Record<string, string> = {
            pending: 'confirmed', confirmed: 'preparing', preparing: 'ready_for_pickup',
            ready_for_pickup: 'picked_up', picked_up: 'delivered',
        };

        const filterStatuses = ORDER_FILTER_MAP[orderFilter];
        const displayed = orderFilter === 'all' ? orders : orders.filter(o => filterStatuses.includes(o.status));

        const filterCounts: Record<OrderFilter, number> = {
            all:       orders.length,
            pending:   orders.filter(o => ORDER_FILTER_MAP.pending.includes(o.status)).length,
            active:    orders.filter(o => ORDER_FILTER_MAP.active.includes(o.status)).length,
            done:      orders.filter(o => o.status === 'delivered').length,
            cancelled: orders.filter(o => o.status === 'cancelled').length,
        };

        return (
            <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ color: '#333' }}>Orders</h3>
                    <button onClick={fetchData} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#f3f4f6', color: '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}><RefreshCw size={14} /> Refresh</button>
                </div>

                {/* Filter tabs */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    {(['all', 'pending', 'active', 'done', 'cancelled'] as OrderFilter[]).map(f => (
                        <button key={f} onClick={() => setOrderFilter(f)}
                            style={{ padding: '6px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500', background: orderFilter === f ? '#ff6b35' : '#f3f4f6', color: orderFilter === f ? '#fff' : '#555' }}>
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                            <span style={{ marginLeft: 6, background: orderFilter === f ? 'rgba(255,255,255,.3)' : '#e5e7eb', borderRadius: 10, padding: '1px 6px', fontSize: 11 }}>
                                {filterCounts[f]}
                            </span>
                        </button>
                    ))}
                </div>

                {displayed.length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead><tr style={{ borderBottom: '2px solid #eee' }}>
                                {['', 'Order #', 'Status', 'Payment', 'Amount', 'Date', 'Action'].map(h => <th key={h} style={{ padding: '12px', textAlign: 'left', fontSize: '13px', color: '#555' }}>{h}</th>)}
                            </tr></thead>
                            <tbody>
                                {displayed.map(o => (
                                    <>
                                        <tr key={o.id} style={{ borderBottom: expandedOrderId === o.id ? 'none' : '1px solid #f5f5f5', cursor: 'pointer' }}>
                                            <td style={{ padding: '12px' }} onClick={() => expandOrder(o.id)}>
                                                {expandedOrderId === o.id ? <ChevronUp size={15} color="#888" /> : <ChevronDown size={15} color="#888" />}
                                            </td>
                                            <td style={{ padding: '12px', fontWeight: '500' }}>{o.order_number}</td>
                                            <td style={{ padding: '12px' }}>{badge(o.status)}</td>
                                            <td style={{ padding: '12px' }}>
                                                <span style={{ padding: '4px 8px', borderRadius: '8px', fontSize: '12px', background: o.payment_status === 'completed' ? '#dcfce7' : '#fef3c7', color: o.payment_status === 'completed' ? '#16a34a' : '#d97706' }}>
                                                    {o.payment_status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px' }}>₦{Number(o.total_amount).toLocaleString()}</td>
                                            <td style={{ padding: '12px', color: '#666', fontSize: '13px' }}>{new Date(o.created_at).toLocaleString()}</td>
                                            <td style={{ padding: '12px' }}>
                                                {nextStatus[o.status] && (
                                                    <button onClick={() => updateOrderStatus(o.id, nextStatus[o.status])}
                                                        style={{ padding: '6px 10px', background: '#ff6b35', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', marginRight: '6px' }}>
                                                        Mark {nextStatus[o.status].replace(/_/g, ' ')}
                                                    </button>
                                                )}
                                                {['pending', 'confirmed', 'preparing'].includes(o.status) && (
                                                    <button onClick={() => updateOrderStatus(o.id, 'cancelled')}
                                                        style={{ padding: '6px 10px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                                                        Cancel
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                        {expandedOrderId === o.id && (
                                            <tr key={`${o.id}-detail`}>
                                                <td colSpan={7} style={{ padding: '0 12px 16px 40px', background: '#f9fafb' }}>
                                                    <div style={{ padding: '16px', background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                                                        <p style={{ fontSize: '12px', color: '#888', fontWeight: '600', marginBottom: '10px', textTransform: 'uppercase' }}>Order Items</p>
                                                        {orderItemsMap[o.id]
                                                            ? orderItemsMap[o.id].map((row: any, i: number) => (
                                                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                                                                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                                                        {row.menu_items?.image_url && <img src={row.menu_items.image_url} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }} />}
                                                                        <div>
                                                                            <p style={{ margin: 0, fontWeight: '500', fontSize: 14 }}>{row.menu_items?.name || 'Item'} × {row.quantity}</p>
                                                                            {row.special_instructions && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>Note: {row.special_instructions}</p>}
                                                                        </div>
                                                                    </div>
                                                                    <span style={{ fontWeight: '600', color: '#333' }}>₦{Number(row.total_price).toLocaleString()}</span>
                                                                </div>
                                                            ))
                                                            : <p style={{ color: '#aaa', fontSize: 13 }}>Loading…</p>
                                                        }
                                                        {(o as any).delivery_address && (
                                                            <p style={{ margin: '12px 0 0', fontSize: '13px', color: '#666' }}>
                                                                Deliver to: {typeof (o as any).delivery_address === 'object'
                                                                    ? [(o as any).delivery_address.street, (o as any).delivery_address.city].filter(Boolean).join(', ')
                                                                    : (o as any).delivery_address}
                                                            </p>
                                                        )}
                                                        {o.notes && <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#888' }}>Customer note: {o.notes}</p>}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>{orderFilter === 'all' ? 'No orders yet' : `No ${orderFilter} orders`}</p>}
            </div>
        );
    };

    // ── Analytics ──────────────────────────────────────────────────────────────
    const renderAnalytics = () => {
        const last7 = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - (6 - i));
            return d.toISOString().split('T')[0];
        });
        const dailyRevenue = last7.map(day => ({
            day:     new Date(day).toLocaleDateString('en', { weekday: 'short' }),
            revenue: orders.filter(o => o.created_at.startsWith(day) && o.payment_status === 'completed').reduce((s, o) => s + Number(o.total_amount), 0),
            count:   orders.filter(o => o.created_at.startsWith(day)).length,
        }));
        const maxRevenue      = Math.max(...dailyRevenue.map(d => d.revenue), 1);
        const totalRevenue    = orders.filter(o => o.payment_status === 'completed').reduce((s, o) => s + Number(o.total_amount), 0);
        const completedOrders = orders.filter(o => o.status === 'delivered').length;
        const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
        const completionRate  = orders.length > 0 ? Math.round((completedOrders / orders.length) * 100) : 0;
        const avgOrderValue   = completedOrders > 0 ? totalRevenue / completedOrders : 0;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '16px' }}>
                    {[
                        { label: 'Total Revenue',    value: `₦${totalRevenue.toLocaleString()}`,              color: '#16a34a' },
                        { label: 'Total Orders',     value: orders.length,                                     color: '#2563eb' },
                        { label: 'Avg Order Value',  value: `₦${Math.round(avgOrderValue).toLocaleString()}`,  color: '#7c3aed' },
                        { label: 'Completion Rate',  value: `${completionRate}%`,                              color: '#d97706' },
                        { label: 'Cancelled Orders', value: cancelledOrders,                                   color: '#dc2626' },
                        { label: 'Menu Items',       value: menuItems.length,                                  color: '#ff6b35' },
                    ].map(c => (
                        <div key={c.label} style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,.08)' }}>
                            <p style={{ color: '#666', fontSize: '13px', marginBottom: '8px' }}>{c.label}</p>
                            <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: c.color }}>{c.value}</p>
                        </div>
                    ))}
                </div>

                {/* Revenue bar chart */}
                <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,.08)' }}>
                    <h3 style={{ color: '#333', marginBottom: '20px' }}>Revenue — Last 7 Days</h3>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '160px' }}>
                        {dailyRevenue.map(d => (
                            <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '11px', color: '#666' }}>{d.revenue > 0 ? `₦${Math.round(d.revenue / 1000)}k` : '₦0'}</span>
                                <div style={{ width: '100%', background: '#ff6b35', borderRadius: '4px 4px 0 0', height: `${Math.max((d.revenue / maxRevenue) * 120, d.revenue > 0 ? 8 : 2)}px`, transition: 'height .3s' }} />
                                <span style={{ fontSize: '11px', color: '#888' }}>{d.day}</span>
                                <span style={{ fontSize: '10px', color: '#aaa' }}>{d.count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top selling items */}
                <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,.08)' }}>
                    <h3 style={{ color: '#333', marginBottom: '16px' }}>Top Selling Items</h3>
                    {topItems.length > 0 ? (
                        <div style={{ display: 'grid', gap: '10px' }}>
                            {topItems.map((item, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f9fafb', borderRadius: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <span style={{ width: 24, height: 24, borderRadius: '50%', background: i === 0 ? '#ff6b35' : i === 1 ? '#f59e0b' : '#6b7280', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                                        <span style={{ color: '#333', fontSize: '14px', fontWeight: '500' }}>{item.name}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                                        <span style={{ color: '#666' }}>{item.count} sold</span>
                                        <span style={{ fontWeight: 'bold', color: '#ff6b35' }}>₦{Math.round(item.revenue).toLocaleString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p style={{ color: '#aaa', textAlign: 'center', padding: 20, fontSize: 14 }}>
                            {orders.length === 0 ? 'No orders yet.' : 'Loading top items…'}
                        </p>
                    )}
                </div>
            </div>
        );
    };

    // ── Settings ──────────────────────────────────────────────────────────────
    const renderSettings = () => vendor ? <VendorSettingsForm vendor={vendor} onSave={(updated) => { setVendor(updated); showToast('Settings saved'); }} /> : null;

    // ── Layout ────────────────────────────────────────────────────────────────
    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ width: '48px', height: '48px', border: '4px solid #f3f3f3', borderTop: '4px solid #ff6b35', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                <p style={{ color: '#666' }}>Loading dashboard…</p>
            </div>
        </div>
    );

    const tabs: { id: TabType; icon: React.ReactNode; label: string }[] = [
        { id: 'overview',   icon: <TrendingUp size={16} />,  label: 'Overview'   },
        { id: 'orders',     icon: <ShoppingBag size={16} />, label: 'Orders'     },
        { id: 'menu',       icon: <Plus size={16} />,        label: 'Menu Items' },
        { id: 'categories', icon: <Tag size={16} />,         label: 'Categories' },
        { id: 'analytics',  icon: <BarChart2 size={16} />,   label: 'Analytics'  },
        { id: 'settings',   icon: <Settings size={16} />,    label: 'Settings'   },
    ];

    return (
        <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
            {toast && (
                <div style={{ position: 'fixed', top: '20px', right: '20px', padding: '12px 20px', borderRadius: '8px', background: toast.type === 'success' ? '#16a34a' : '#dc2626', color: '#fff', fontWeight: '500', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,.2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle size={16} /> {toast.msg}
                </div>
            )}

            <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, fontSize: '1.3rem', fontWeight: 800, color: '#ff6b35', letterSpacing: '-0.5px', flexShrink: 0 }}>
                        🍴 Fooda
                    </Link>
                    <div style={{ width: 1, height: 28, background: '#e5e7eb' }} />
                    <div>
                        <h1 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#333', marginBottom: '2px' }}>{vendor?.name || 'Vendor Dashboard'}</h1>
                        <p style={{ color: '#666', fontSize: '13px' }}>{user?.email}</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {unreadCount > 0 && (
                        <div style={{ position: 'relative' }}>
                            <Bell size={20} color="#666" />
                            <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ff6b35', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadCount}</span>
                        </div>
                    )}
                    <button
                        onClick={() => { signOut(); navigate('/auth'); }}
                        title="Sign out"
                        aria-label="Sign out"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '9px 14px',
                            background: '#fff',
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
                </div>
            </header>

            <div style={{ padding: '32px 40px' }}>
                <div style={{ marginBottom: '28px', borderBottom: '1px solid #e5e7eb', overflowX: 'auto' }}>
                    <div style={{ display: 'flex', gap: '24px', minWidth: 'max-content' }}>
                        {tabs.map(t => (
                            <button key={t.id} onClick={() => setActiveTab(t.id)}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 0', background: 'transparent', border: 'none', borderBottom: activeTab === t.id ? '2px solid #ff6b35' : '2px solid transparent', color: activeTab === t.id ? '#ff6b35' : '#666', cursor: 'pointer', fontWeight: activeTab === t.id ? '600' : '400', fontSize: '14px', whiteSpace: 'nowrap' }}>
                                {t.icon}{t.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ maxWidth: '1400px' }}>
                    {activeTab === 'overview'   && renderOverview()}
                    {activeTab === 'orders'     && renderOrders()}
                    {activeTab === 'menu'       && renderMenu()}
                    {activeTab === 'categories' && renderCategories()}
                    {activeTab === 'analytics'  && renderAnalytics()}
                    {activeTab === 'settings'   && renderSettings()}
                </div>
            </div>

            {showMenuModal && (
                <MenuItemModal
                    vendor={vendor!}
                    item={editingItem}
                    onClose={() => { setShowMenuModal(false); setEditingItem(null); }}
                    onSave={() => { setShowMenuModal(false); setEditingItem(null); fetchData(); showToast('Menu item saved'); }}
                />
            )}

            {showCategoryModal && (
                <CategoryModal vendor={vendor!} category={editingCategory}
                    onClose={() => { setShowCategoryModal(false); setEditingCategory(null); }}
                    onSave={() => { setShowCategoryModal(false); setEditingCategory(null); fetchData(); showToast('Category saved'); }} />
            )}

            <style>{`@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}`}</style>
        </div>
    );
};

// ─── Category Modal ───────────────────────────────────────────────────────────
const CategoryModal = ({ vendor, category, onClose, onSave }: { vendor: Vendor; category: MenuCategory | null; onClose: () => void; onSave: () => void }) => {
    const [form, setForm] = useState({ name: category?.name || '', description: category?.description || '', is_active: category?.is_active ?? true, sort_order: category?.sort_order ?? 0 });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setSaving(true); setError('');
        try {
            if (category) {
                const { error: err } = await supabase.from('menu_categories').update(form).eq('id', category.id);
                if (err) throw err;
            } else {
                const { error: err } = await supabase.from('menu_categories').insert({ ...form, vendor_id: vendor.id });
                if (err) throw err;
            }
            onSave();
        } catch (err: any) { setError(err.message); } finally { setSaving(false); }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '420px', maxWidth: '95vw' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ color: '#333' }}>{category ? 'Edit Category' : 'Add Category'}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    {error && <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>{error}</div>}
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', color: '#555', fontWeight: '500', fontSize: '14px' }}>Category Name *</label>
                        <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} placeholder="e.g. Burgers, Drinks, Sides" />
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', color: '#555', fontWeight: '500', fontSize: '14px' }}>Description</label>
                        <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', color: '#555', fontWeight: '500', fontSize: '14px' }}>Display Order</label>
                        <input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} style={inputStyle} />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                        <span style={{ color: '#555', fontSize: '14px' }}>Active (visible to customers)</span>
                    </label>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button type="button" onClick={onClose} style={{ flex: 1, padding: '12px', background: '#f3f4f6', color: '#333', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                        <button type="submit" disabled={saving} style={{ flex: 1, padding: '12px', background: '#ff6b35', color: '#fff', border: 'none', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .7 : 1 }}>
                            {saving ? 'Saving…' : (category ? 'Update' : 'Create')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─── Vendor Settings Form ────────────────────────────────────────────────────
const VendorSettingsForm = ({ vendor, onSave }: { vendor: Vendor; onSave: (v: Vendor) => void }) => {
    const [form, setForm] = useState({ name: vendor.name || '', email: vendor.email || '', phone: vendor.phone || '', description: vendor.description || '', logo_url: vendor.logo_url || '', cover_image_url: vendor.cover_image_url || '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const logoRef  = useRef<HTMLInputElement>(null);
    const coverRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState<'logo' | 'cover' | null>(null);

    const handleImageUpload = async (file: File, field: 'logo_url' | 'cover_image_url') => {
        setUploading(field === 'logo_url' ? 'logo' : 'cover');
        try {
            const ext  = file.name.split('.').pop() ?? 'jpg';
            const path = `${vendor.id}/${field === 'logo_url' ? 'logo' : 'cover'}_${Date.now()}.${ext}`;
            const { error: upErr } = await supabase.storage.from('vendor-images').upload(path, file, { upsert: true, contentType: file.type });
            if (upErr) throw new Error(upErr.message);
            const { data } = supabase.storage.from('vendor-images').getPublicUrl(path);
            setForm(prev => ({ ...prev, [field]: data.publicUrl }));
        } catch (err: any) {
            setError(`Image upload failed: ${err.message}. Create a public "vendor-images" bucket in Supabase Storage.`);
        } finally {
            setUploading(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setSaving(true); setError('');
        const { data, error: err } = await supabase.from('vendors').update(form).eq('id', vendor.id).select().single();
        setSaving(false);
        if (err) { setError(err.message); return; }
        onSave(data as Vendor);
    };

    const ImageUploadField = ({ label, field, currentUrl, inputRef }: { label: string; field: 'logo_url' | 'cover_image_url'; currentUrl: string; inputRef: React.RefObject<HTMLInputElement | null> }) => (
        <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', marginBottom: '6px', color: '#555', fontWeight: '500', fontSize: '14px' }}>{label}</label>
            {currentUrl && <img src={currentUrl} alt="" style={{ width: field === 'logo_url' ? 80 : '100%', height: field === 'logo_url' ? 80 : 120, borderRadius: field === 'logo_url' ? '50%' : 10, objectFit: 'cover', marginBottom: 8, display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input style={{ ...inputStyle, flex: 1 }} placeholder="https://…or upload below" value={currentUrl} onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))} />
                <button type="button" onClick={() => inputRef.current?.click()}
                    style={{ padding: '10px 14px', background: '#f3f4f6', color: '#555', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, flexShrink: 0 }}>
                    <Upload size={14} /> {uploading === (field === 'logo_url' ? 'logo' : 'cover') ? 'Uploading…' : 'Upload'}
                </button>
            </div>
            <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, field); }} />
        </div>
    );

    return (
        <div style={{ background: '#fff', padding: '28px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,.08)', maxWidth: '600px' }}>
            <h3 style={{ color: '#333', marginBottom: '24px' }}>Restaurant Settings</h3>
            <form onSubmit={handleSubmit}>
                {error && <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>{error}</div>}
                {[
                    { key: 'name',  label: 'Restaurant Name *', type: 'text',  req: true  },
                    { key: 'email', label: 'Contact Email',      type: 'email', req: false },
                    { key: 'phone', label: 'Phone Number',       type: 'text',  req: false },
                ].map(f => (
                    <div key={f.key} style={{ marginBottom: '18px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', color: '#555', fontWeight: '500', fontSize: '14px' }}>{f.label}</label>
                        <input required={f.req} type={f.type} value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} style={inputStyle} />
                    </div>
                ))}
                <div style={{ marginBottom: '18px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', color: '#555', fontWeight: '500', fontSize: '14px' }}>Description</label>
                    <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
                <ImageUploadField label="Logo" field="logo_url" currentUrl={form.logo_url} inputRef={logoRef} />
                <ImageUploadField label="Cover Image" field="cover_image_url" currentUrl={form.cover_image_url} inputRef={coverRef} />
                <button type="submit" disabled={saving} style={{ padding: '12px 28px', background: '#ff6b35', color: '#fff', border: 'none', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: '500', opacity: saving ? .7 : 1 }}>
                    {saving ? 'Saving…' : 'Save Changes'}
                </button>
            </form>
        </div>
    );
};

// ─── Menu Item Modal ──────────────────────────────────────────────────────────
const MenuItemModal = ({ vendor, item, onClose, onSave }: { vendor: Vendor; item: MenuItem | null; onClose: () => void; onSave: () => void }) => {
    const [form, setForm] = useState({
        name: item?.name || '', description: item?.description || '', price: item?.price || '',
        category_id: item?.category_id || '', image_url: item?.image_url || '',
        is_available: item?.is_available ?? true, is_vegetarian: item?.is_vegetarian || false,
        is_vegan: item?.is_vegan || false, prep_time: item?.prep_time || '',
    });
    const [categories, setCategories] = useState<MenuCategory[]>([]);
    const [addons, setAddons] = useState<any[]>([]);
    const [newAddon, setNewAddon] = useState({ name: '', price: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [localPreview, setLocalPreview] = useState('');
    const [uploading, setUploading] = useState(false);
    const [showQuickCat, setShowQuickCat] = useState(false);
    const [quickCatName, setQuickCatName] = useState('');
    const [quickCatSaving, setQuickCatSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch this vendor's categories fresh each time modal opens
    useEffect(() => {
        supabase.from('menu_categories').select('*').eq('vendor_id', vendor.id).order('sort_order')
            .then(({ data }) => setCategories(data || []));
    }, [vendor.id]);

    useEffect(() => {
        if (item?.id) {
            supabase.from('menu_item_addons').select('*').eq('menu_item_id', item.id).order('sort_order')
                .then(r => setAddons(r.data || []));
        }
    }, [item]);

    // Revoke object URL on unmount
    useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImageFile(file);
        if (localPreview) URL.revokeObjectURL(localPreview);
        setLocalPreview(URL.createObjectURL(file));
        setForm(prev => ({ ...prev, image_url: '' }));
    };

    const createQuickCategory = async () => {
        if (!quickCatName.trim()) return;
        setQuickCatSaving(true);
        const { data, error: err } = await supabase.from('menu_categories')
            .insert({ vendor_id: vendor.id, name: quickCatName.trim(), is_active: true, sort_order: 0 })
            .select().single();
        setQuickCatSaving(false);
        if (err) { setError(err.message); return; }
        setCategories(prev => [...prev, data]);
        setForm(prev => ({ ...prev, category_id: data.id }));
        setQuickCatName('');
        setShowQuickCat(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setSaving(true); setError('');
        try {
            let finalImageUrl = form.image_url;

            if (imageFile) {
                setUploading(true);
                finalImageUrl = await uploadMenuImage(imageFile, vendor.id);
                setUploading(false);
            }

            const payload = {
                ...form,
                vendor_id:   vendor.id,
                price:       parseFloat(form.price as any),
                prep_time:   form.prep_time ? parseInt(form.prep_time as any) : null,
                category_id: form.category_id || null,
                image_url:   finalImageUrl || null,
            };

            let menuItemId = item?.id;
            if (item) {
                const { error: err } = await supabase.from('menu_items').update(payload).eq('id', item.id);
                if (err) throw err;
            } else {
                const { data, error: err } = await supabase.from('menu_items').insert(payload).select().single();
                if (err) throw err;
                menuItemId = data.id;
            }

            if (menuItemId) {
                await supabase.from('menu_item_addons').delete().eq('menu_item_id', menuItemId);
                if (addons.length > 0) {
                    await supabase.from('menu_item_addons').insert(
                        addons.map((a, i) => ({ menu_item_id: menuItemId, name: a.name, price: parseFloat(a.price) || 0, is_available: true, sort_order: i }))
                    );
                }
            }
            onSave();
        } catch (err: any) {
            setError(err.message);
            setUploading(false);
        } finally {
            setSaving(false);
        }
    };

    const previewSrc = localPreview || form.image_url;

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '540px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ color: '#333' }}>{item ? 'Edit Menu Item' : 'Add Menu Item'}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit}>
                    {error && <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>{error}</div>}

                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', color: '#555', fontWeight: '500', fontSize: '14px' }}>Item Name *</label>
                        <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', color: '#555', fontWeight: '500', fontSize: '14px' }}>Description</label>
                        <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', color: '#555', fontWeight: '500', fontSize: '14px' }}>Price (₦) *</label>
                            <input required type="number" step="0.01" min="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} style={inputStyle} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', color: '#555', fontWeight: '500', fontSize: '14px' }}>Prep Time (min)</label>
                            <input type="number" value={form.prep_time} onChange={e => setForm({ ...form, prep_time: e.target.value })} style={inputStyle} />
                        </div>
                    </div>

                    {/* Category with quick-create */}
                    <div style={{ marginBottom: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <label style={{ color: '#555', fontWeight: '500', fontSize: '14px' }}>Category</label>
                            {!showQuickCat && (
                                <button type="button" onClick={() => setShowQuickCat(true)}
                                    style={{ background: 'none', border: 'none', color: '#ff6b35', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                                    + New category
                                </button>
                            )}
                        </div>
                        {showQuickCat ? (
                            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                <input
                                    autoFocus
                                    placeholder="Category name"
                                    value={quickCatName}
                                    onChange={e => setQuickCatName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createQuickCategory(); } }}
                                    style={{ ...inputStyle, flex: 1 }}
                                />
                                <button type="button" onClick={createQuickCategory} disabled={quickCatSaving}
                                    style={{ padding: '10px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
                                    {quickCatSaving ? '…' : 'Create'}
                                </button>
                                <button type="button" onClick={() => setShowQuickCat(false)}
                                    style={{ padding: '10px', background: '#f3f4f6', color: '#555', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                                    <X size={14} />
                                </button>
                            </div>
                        ) : null}
                        <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} style={inputStyle}>
                            <option value="">— No category —</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        {categories.length === 0 && (
                            <p style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>No categories yet — click "+ New category" above to create one.</p>
                        )}
                    </div>

                    {/* Image: upload from device OR paste URL */}
                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', color: '#555', fontWeight: '500', fontSize: '14px' }}>Item Image</label>

                        {/* Upload area */}
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            style={{ border: '2px dashed #e5e7eb', borderRadius: 8, padding: '16px', textAlign: 'center', cursor: 'pointer', marginBottom: 10, background: '#fafafa', transition: 'border-color .2s' }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = '#ff6b35')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
                        >
                            {previewSrc ? (
                                <img src={previewSrc} alt="Preview" style={{ maxHeight: 120, borderRadius: 6, objectFit: 'cover', display: 'block', margin: '0 auto 8px' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            ) : (
                                <ImageIcon size={32} color="#ccc" style={{ margin: '0 auto 8px', display: 'block' }} />
                            )}
                            <p style={{ margin: 0, fontSize: 13, color: '#888' }}>
                                <Upload size={13} style={{ display: 'inline', marginRight: 4 }} />
                                {uploading ? 'Uploading…' : imageFile ? imageFile.name : 'Click to upload from device'}
                            </p>
                            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#bbb' }}>JPG, PNG, WebP · Max 5MB</p>
                        </div>
                        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />

                        {/* Or paste URL */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                            <span style={{ fontSize: 11, color: '#aaa' }}>or paste URL</span>
                            <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                        </div>
                        <input
                            type="url"
                            value={form.image_url}
                            onChange={e => {
                                setForm({ ...form, image_url: e.target.value });
                                if (e.target.value) { setImageFile(null); if (localPreview) { URL.revokeObjectURL(localPreview); setLocalPreview(''); } }
                            }}
                            placeholder="https://example.com/image.jpg"
                            style={inputStyle}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '20px', marginBottom: '16px' }}>
                        {([['is_available', 'Available'], ['is_vegetarian', 'Vegetarian'], ['is_vegan', 'Vegan']] as [string, string][]).map(([k, l]) => (
                            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px', color: '#555' }}>
                                <input type="checkbox" checked={(form as any)[k]} onChange={e => setForm({ ...form, [k]: e.target.checked })} /> {l}
                            </label>
                        ))}
                    </div>

                    {/* Add-ons */}
                    <div style={{ marginBottom: '20px', padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
                        <h4 style={{ color: '#333', fontSize: '14px', fontWeight: '600', marginBottom: '10px' }}>Add-ons / Extras</h4>
                        {addons.map((a, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#fff', borderRadius: '6px', marginBottom: '6px', border: '1px solid #e5e7eb' }}>
                                <span style={{ fontSize: '14px' }}>{a.name} — ₦{parseFloat(a.price || 0).toLocaleString()}</span>
                                <button type="button" onClick={() => setAddons(addons.filter((_, j) => j !== i))} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '12px' }}>Remove</button>
                            </div>
                        ))}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <input placeholder="Add-on name" value={newAddon.name} onChange={e => setNewAddon({ ...newAddon, name: e.target.value })} style={{ flex: 2, padding: '8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px' }} />
                            <input type="number" placeholder="Price ₦" step="0.01" value={newAddon.price} onChange={e => setNewAddon({ ...newAddon, price: e.target.value })} style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px' }} />
                            <button type="button" onClick={() => { if (!newAddon.name) return; setAddons([...addons, { ...newAddon }]); setNewAddon({ name: '', price: '' }); }}
                                style={{ padding: '8px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Add</button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button type="button" onClick={onClose} style={{ flex: 1, padding: '12px', background: '#f3f4f6', color: '#333', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                        <button type="submit" disabled={saving || uploading} style={{ flex: 1, padding: '12px', background: '#ff6b35', color: '#fff', border: 'none', borderRadius: '8px', cursor: saving || uploading ? 'not-allowed' : 'pointer', opacity: saving || uploading ? .7 : 1 }}>
                            {uploading ? 'Uploading image…' : saving ? 'Saving…' : (item ? 'Update' : 'Add Item')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default VendorDashboard;
