import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Order } from '../types/database';

const VendorOrders: React.FC = () => {
    const { vendor } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('all');

    useEffect(() => {
        if (vendor) {
            fetchOrders();

            // Subscribe to real-time updates
            const subscription = supabase
                .channel('vendor_orders')
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'orders', filter: `vendor_id=eq.${vendor.id}` },
                    () => fetchOrders()
                )
                .subscribe();

            return () => {
                subscription.unsubscribe();
            };
        }
    }, [vendor]);

    const fetchOrders = async () => {
        if (!vendor) return;

        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    customer:users!orders_customer_id_fkey(id, full_name, phone, email),
                    order_items(id, quantity, price_per_unit, total_price, special_instructions, menu_item:menu_items(id, name))
                `)
                .eq('vendor_id', vendor.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (err) {
            console.error('Error fetching orders:', err);
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
            fetchOrders();
        } catch (err) {
            console.error('Error updating order:', err);
        }
    };

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            case 'confirmed': return 'bg-blue-100 text-blue-800 border-blue-300';
            case 'preparing': return 'bg-purple-100 text-purple-800 border-purple-300';
            case 'ready_for_pickup': return 'bg-green-100 text-green-800 border-green-300';
            case 'picked_up': return 'bg-orange-100 text-orange-800 border-orange-300';
            case 'delivered': return 'bg-teal-100 text-teal-800 border-teal-300';
            case 'cancelled': return 'bg-red-100 text-red-800 border-red-300';
            default: return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    };

    const formatStatus = (status: string) => {
        return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const filteredOrders = orders.filter(order => {
        return statusFilter === 'all' || order.status === statusFilter;
    });

    const orderStats = {
        pending: orders.filter(o => o.status === 'pending').length,
        preparing: orders.filter(o => o.status === 'preparing').length,
        ready: orders.filter(o => o.status === 'ready_for_pickup').length,
        delivered: orders.filter(o => o.status === 'delivered').length
    };

    if (loading) {
        return (
            <div className="p-6">
                <div className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white p-4 rounded-xl">
                                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
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
                <h1 className="text-2xl font-bold text-gray-800">Orders</h1>
                <button
                    onClick={fetchOrders}
                    className="flex items-center px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition duration-200"
                >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 cursor-pointer hover:shadow-md transition duration-200"
                    onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}>
                    <p className="text-3xl font-bold text-yellow-600">{orderStats.pending}</p>
                    <p className="text-sm text-yellow-700">Pending</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 cursor-pointer hover:shadow-md transition duration-200"
                    onClick={() => setStatusFilter(statusFilter === 'preparing' ? 'all' : 'preparing')}>
                    <p className="text-3xl font-bold text-purple-600">{orderStats.preparing}</p>
                    <p className="text-sm text-purple-700">Preparing</p>
                </div>
                <div className="bg-green-50 p-4 rounded-xl border border-green-200 cursor-pointer hover:shadow-md transition duration-200"
                    onClick={() => setStatusFilter(statusFilter === 'ready_for_pickup' ? 'all' : 'ready_for_pickup')}>
                    <p className="text-3xl font-bold text-green-600">{orderStats.ready}</p>
                    <p className="text-sm text-green-700">Ready</p>
                </div>
                <div className="bg-teal-50 p-4 rounded-xl border border-teal-200 cursor-pointer hover:shadow-md transition duration-200"
                    onClick={() => setStatusFilter(statusFilter === 'delivered' ? 'all' : 'delivered')}>
                    <p className="text-3xl font-bold text-teal-600">{orderStats.delivered}</p>
                    <p className="text-sm text-teal-700">Delivered</p>
                </div>
            </div>

            {/* Filter */}
            <div className="bg-white p-4 rounded-xl shadow-sm mb-6">
                <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">Filter:</span>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    >
                        <option value="all">All Orders ({orders.length})</option>
                        <option value="pending">Pending ({orders.filter(o => o.status === 'pending').length})</option>
                        <option value="confirmed">Confirmed ({orders.filter(o => o.status === 'confirmed').length})</option>
                        <option value="preparing">Preparing ({orders.filter(o => o.status === 'preparing').length})</option>
                        <option value="ready_for_pickup">Ready for Pickup ({orders.filter(o => o.status === 'ready_for_pickup').length})</option>
                        <option value="picked_up">Picked Up ({orders.filter(o => o.status === 'picked_up').length})</option>
                        <option value="delivered">Delivered ({orders.filter(o => o.status === 'delivered').length})</option>
                        <option value="cancelled">Cancelled ({orders.filter(o => o.status === 'cancelled').length})</option>
                    </select>
                </div>
            </div>

            {/* Orders List */}
            {filteredOrders.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                    <span className="text-6xl mb-4 block">📋</span>
                    <p className="text-gray-500">No orders found</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredOrders.map((order) => (
                        <div
                            key={order.id}
                            className={`bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition duration-200 ${order.status === 'pending' ? 'ring-2 ring-yellow-400' : ''
                                }`}
                        >
                            <div className={`h-1 ${getStatusClass(order.status).replace('bg-', 'bg-').replace('-100', '-500')}`}></div>
                            <div className="p-4">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-12 h-12 bg-gradient-to-r from-teal-400 to-green-400 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                            {(order.customer as any)?.full_name?.charAt(0) || 'C'}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-800">{order.order_number}</p>
                                            <p className="text-sm text-gray-500">
                                                {(order.customer as any)?.full_name || 'Customer'} • {(order.customer as any)?.phone || 'No phone'}
                                            </p>
                                            <p className="text-xs text-gray-400">{formatDate(order.created_at)}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xl font-bold text-teal-600">{formatCurrency(order.total_amount)}</p>
                                        <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusClass(order.status)}`}>
                                            {formatStatus(order.status)}
                                        </span>
                                    </div>
                                </div>

                                {/* Order Items */}
                                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                                    {(order.order_items as any[])?.map((item, idx) => (
                                        <div key={idx} className="flex justify-between py-1 text-sm">
                                            <span className="text-gray-700">
                                                <span className="font-medium">{item.quantity}x</span> {item.menu_item?.name || 'Item'}
                                            </span>
                                            <span className="text-gray-600">{formatCurrency(item.total_price)}</span>
                                        </div>
                                    )) || <p className="text-gray-500 text-sm">No items</p>}
                                    {order.notes && (
                                        <div className="mt-2 pt-2 border-t border-gray-200">
                                            <p className="text-xs text-gray-500">📝 Note: {order.notes}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Quick Actions */}
                                <div className="flex space-x-2">
                                    {order.status === 'pending' && (
                                        <>
                                            <button
                                                onClick={() => updateOrderStatus(order.id, 'confirmed')}
                                                className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-200 font-medium"
                                            >
                                                ✓ Accept Order
                                            </button>
                                            <button
                                                onClick={() => updateOrderStatus(order.id, 'cancelled')}
                                                className="py-2 px-4 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition duration-200"
                                            >
                                                ✕ Reject
                                            </button>
                                        </>
                                    )}
                                    {order.status === 'confirmed' && (
                                        <button
                                            onClick={() => updateOrderStatus(order.id, 'preparing')}
                                            className="flex-1 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition duration-200 font-medium"
                                        >
                                            🍳 Start Preparing
                                        </button>
                                    )}
                                    {order.status === 'preparing' && (
                                        <button
                                            onClick={() => updateOrderStatus(order.id, 'ready_for_pickup')}
                                            className="flex-1 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition duration-200 font-medium"
                                        >
                                            ✓ Ready for Pickup
                                        </button>
                                    )}
                                    {(order.status === 'picked_up' || order.status === 'ready_for_pickup') && (
                                        <button
                                            onClick={() => updateOrderStatus(order.id, 'delivered')}
                                            className="flex-1 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition duration-200 font-medium"
                                        >
                                            📦 Mark Delivered
                                        </button>
                                    )}
                                    {(order.status === 'delivered' || order.status === 'cancelled') && (
                                        <div className="flex-1 py-2 bg-gray-100 text-gray-500 rounded-lg text-center">
                                            {order.status === 'delivered' ? '✓ Completed' : '✕ Cancelled'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default VendorOrders;
