import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Order, VendorStats } from '../types/database';

const VendorDashboard: React.FC = () => {
    const { vendor } = useAuth();
    const [stats, setStats] = useState<VendorStats>({
        todayOrders: 0,
        todayRevenue: 0,
        pendingOrders: 0,
        averageRating: 0,
        totalMenuItems: 0,
        activeMenuItems: 0
    });
    const [recentOrders, setRecentOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (vendor) {
            fetchDashboardData();
        }
    }, [vendor]);

    const fetchDashboardData = async () => {
        if (!vendor) return;

        try {
            setLoading(true);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Fetch all data in parallel
            const [ordersResult, menuItemsResult, reviewsResult, recentOrdersResult] = await Promise.all([
                // Today's orders
                supabase
                    .from('orders')
                    .select('id, total_amount, status')
                    .eq('vendor_id', vendor.id)
                    .gte('created_at', today.toISOString()),
                // Menu items
                supabase
                    .from('menu_items')
                    .select('id, is_available')
                    .eq('vendor_id', vendor.id),
                // Reviews
                supabase
                    .from('reviews')
                    .select('rating')
                    .eq('vendor_id', vendor.id),
                // Recent orders
                supabase
                    .from('orders')
                    .select(`
                        *,
                        customer:users!orders_customer_id_fkey(id, full_name, phone),
                        order_items(id, quantity, menu_item:menu_items(name))
                    `)
                    .eq('vendor_id', vendor.id)
                    .order('created_at', { ascending: false })
                    .limit(10)
            ]);

            const orders = ordersResult.data || [];
            const menuItems = menuItemsResult.data || [];
            const reviews = reviewsResult.data || [];

            const todayRevenue = orders
                .filter(o => o.status === 'delivered')
                .reduce((sum, o) => sum + (o.total_amount || 0), 0);

            const avgRating = reviews.length > 0
                ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
                : 0;

            setStats({
                todayOrders: orders.length,
                todayRevenue,
                pendingOrders: orders.filter(o => ['pending', 'confirmed', 'preparing'].includes(o.status)).length,
                averageRating: Math.round(avgRating * 10) / 10,
                totalMenuItems: menuItems.length,
                activeMenuItems: menuItems.filter(m => m.is_available).length
            });

            setRecentOrders(recentOrdersResult.data || []);
        } catch (err) {
            console.error('Error fetching dashboard data:', err);
        } finally {
            setLoading(false);
        }
    };

    const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
        try {
            await supabase
                .from('orders')
                .update({ status: newStatus })
                .eq('id', orderId);
            fetchDashboardData();
        } catch (err) {
            console.error('Error updating order:', err);
        }
    };

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            case 'confirmed': return 'bg-blue-100 text-blue-800';
            case 'preparing': return 'bg-purple-100 text-purple-800';
            case 'ready_for_pickup': return 'bg-green-100 text-green-800';
            case 'picked_up': return 'bg-orange-100 text-orange-800';
            case 'delivered': return 'bg-green-100 text-green-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const formatStatus = (status: string) => {
        return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="p-6">
                <div className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
                    <div className="grid grid-cols-4 gap-4 mb-6">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="bg-white p-6 rounded-xl">
                                <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
                                <div className="h-4 bg-gray-200 rounded w-24"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Welcome back!</h1>
                    <p className="text-gray-500">{vendor?.name}</p>
                </div>
                <button
                    onClick={fetchDashboardData}
                    className="flex items-center px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition duration-200"
                >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500 uppercase">Today's Orders</p>
                            <p className="text-3xl font-bold text-gray-800 mt-1">{stats.todayOrders}</p>
                        </div>
                        <div className="p-3 bg-blue-100 rounded-full">
                            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                        </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                        <span className="text-yellow-500 font-medium">{stats.pendingOrders}</span> pending
                    </p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-green-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500 uppercase">Today's Revenue</p>
                            <p className="text-3xl font-bold text-gray-800 mt-1">{formatCurrency(stats.todayRevenue)}</p>
                        </div>
                        <div className="p-3 bg-green-100 rounded-full">
                            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-yellow-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500 uppercase">Average Rating</p>
                            <p className="text-3xl font-bold text-gray-800 mt-1">⭐ {stats.averageRating || 'N/A'}</p>
                        </div>
                        <div className="p-3 bg-yellow-100 rounded-full">
                            <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-purple-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500 uppercase">Menu Items</p>
                            <p className="text-3xl font-bold text-gray-800 mt-1">{stats.totalMenuItems}</p>
                        </div>
                        <div className="p-3 bg-purple-100 rounded-full">
                            <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                        <span className="text-green-500 font-medium">{stats.activeMenuItems}</span> active
                    </p>
                </div>
            </div>

            {/* Recent Orders */}
            <div className="bg-white p-6 rounded-xl shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-800">Recent Orders</h2>
                    <a href="/orders" className="text-teal-500 hover:text-teal-600 font-medium text-sm">
                        View All →
                    </a>
                </div>

                {recentOrders.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <p>No orders yet</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {recentOrders.map((order) => (
                            <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition duration-200">
                                <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 bg-gradient-to-r from-teal-400 to-green-400 rounded-full flex items-center justify-center text-white font-bold">
                                        {(order.customer as any)?.full_name?.charAt(0) || 'C'}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-800">
                                            {order.order_number}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            {(order.customer as any)?.full_name || 'Customer'} • {formatTime(order.created_at)}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {(order.order_items as any[])?.length || 0} items
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <p className="font-bold text-gray-800">{formatCurrency(order.total_amount)}</p>
                                    <select
                                        value={order.status}
                                        onChange={(e) => updateOrderStatus(order.id, e.target.value as Order['status'])}
                                        className={`px-3 py-1 rounded-full text-sm font-medium border-0 ${getStatusClass(order.status)}`}
                                    >
                                        <option value="pending">Pending</option>
                                        <option value="confirmed">Confirmed</option>
                                        <option value="preparing">Preparing</option>
                                        <option value="ready_for_pickup">Ready for Pickup</option>
                                        <option value="picked_up">Picked Up</option>
                                        <option value="delivered">Delivered</option>
                                        <option value="cancelled">Cancelled</option>
                                    </select>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default VendorDashboard;