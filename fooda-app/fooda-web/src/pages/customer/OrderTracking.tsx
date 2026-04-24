import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface OrderDetail {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  subtotal: number;
  tax_amount: number;
  delivery_fee: number;
  total_amount: number;
  delivery_address?: { street?: string; area?: string; city?: string };
  notes?: string;
  created_at: string;
  estimated_delivery_time?: string;
  vendor: { name: string; phone?: string; address?: Record<string, string> } | null;
  items: { id: string; quantity: number; price_per_unit: number; total_price: number; menu_item: { name: string } | null }[];
}

const STATUS_STEPS = [
  { key: 'pending', label: 'Order Placed', icon: '📋' },
  { key: 'confirmed', label: 'Confirmed', icon: '✅' },
  { key: 'preparing', label: 'Preparing', icon: '👨‍🍳' },
  { key: 'ready_for_pickup', label: 'Ready', icon: '🛍️' },
  { key: 'picked_up', label: 'On the way', icon: '🛵' },
  { key: 'delivered', label: 'Delivered', icon: '🎉' },
];

const CANCELLED_STEP = { key: 'cancelled', label: 'Cancelled', icon: '❌' };

const statusIndex = (status: string) => STATUS_STEPS.findIndex(s => s.key === status);

const OrderTracking = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    fetchOrder();

    // Subscribe to real-time order status updates
    const channel = supabase
      .channel(`order-tracking-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        () => fetchOrder()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, id]);

  const fetchOrder = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, order_number, status, payment_status,
        subtotal, tax_amount, delivery_fee, total_amount,
        delivery_address, notes, created_at, estimated_delivery_time,
        vendor:vendors(name, phone, address),
        items:order_items(id, quantity, price_per_unit, total_price, menu_item:menu_items(name))
      `)
      .eq('id', id)
      .single();

    if (error || !data) { setNotFound(true); setLoading(false); return; }
    setOrder(data as unknown as OrderDetail);
    setLoading(false);
  };

  if (!user) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif', gap: 12 }}>
      <p>Please sign in to view your order.</p>
      <Link to="/auth" style={{ color: '#ff6b35', fontWeight: 600 }}>Sign In</Link>
    </div>
  );

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif', color: '#888' }}>
      <p>Loading order…</p>
    </div>
  );

  if (notFound || !order) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif', gap: 12 }}>
      <div style={{ fontSize: 48 }}>🔍</div>
      <h2 style={{ margin: 0 }}>Order not found</h2>
      <Link to="/orders" style={{ color: '#ff6b35', fontWeight: 600 }}>View all orders</Link>
    </div>
  );

  const isCancelled = order.status === 'cancelled';
  const currentStepIdx = isCancelled ? -1 : statusIndex(order.status);
  const steps = isCancelled ? [...STATUS_STEPS.slice(0, Math.max(statusIndex('pending') + 1, 1)), CANCELLED_STEP] : STATUS_STEPS;

  const statusColors: Record<string, string> = {
    delivered: '#16a34a',
    cancelled: '#dc2626',
    pending: '#f59e0b',
    confirmed: '#3b82f6',
    preparing: '#8b5cf6',
    ready_for_pickup: '#06b6d4',
    picked_up: '#ff6b35',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <header style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 50 }}>
        <button onClick={() => navigate('/orders')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#555' }}>←</button>
        <div>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a1a' }}>Order #{order.order_number}</span>
          <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>{new Date(order.created_at).toLocaleString()}</p>
        </div>
        <span style={{ marginLeft: 'auto', background: `${statusColors[order.status]}20`, color: statusColors[order.status], padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>
          {order.status.replace(/_/g, ' ')}
        </span>
      </header>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px' }}>
        {/* Live tracking notice */}
        {!isCancelled && order.status !== 'delivered' && (
          <div style={{ background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}>
            <span style={{ fontSize: 20 }}>📡</span>
            <span style={{ color: '#8b5000' }}>This page updates automatically as your order progresses.</span>
          </div>
        )}

        {/* Status timeline */}
        <section style={{ background: '#fff', borderRadius: 16, padding: 24, marginBottom: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 24px', fontSize: 16, fontWeight: 700 }}>Order Progress</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {steps.map((step, idx) => {
              const isDone = isCancelled
                ? step.key === 'cancelled'
                : idx <= currentStepIdx;
              const isActive = isCancelled
                ? step.key === 'cancelled'
                : idx === currentStepIdx;
              const isLast = idx === steps.length - 1;

              return (
                <div key={step.key} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  {/* Timeline line + dot */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32, flexShrink: 0 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: isDone ? (isCancelled && step.key === 'cancelled' ? '#dc2626' : '#16a34a') : '#f0f0f0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16,
                      border: isActive ? '3px solid ' + (isCancelled ? '#dc2626' : '#ff6b35') : 'none',
                      boxSizing: 'border-box',
                      transition: 'all 0.3s',
                    }}>
                      {isDone ? '✓' : step.icon}
                    </div>
                    {!isLast && <div style={{ width: 2, height: 24, background: isDone ? '#d1fae5' : '#f0f0f0', margin: '2px 0' }} />}
                  </div>

                  {/* Label */}
                  <div style={{ paddingBottom: isLast ? 0 : 24, paddingTop: 4 }}>
                    <p style={{ margin: 0, fontWeight: isActive ? 700 : 500, color: isDone ? '#1a1a1a' : '#aaa', fontSize: 15 }}>
                      {step.label}
                    </p>
                    {isActive && !isCancelled && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#ff6b35' }}>In progress…</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Restaurant info */}
        {order.vendor && (
          <section style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>Restaurant</h3>
            <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: '#1a1a1a' }}>{order.vendor.name}</p>
            {order.vendor.phone && <p style={{ margin: 0, fontSize: 13, color: '#888' }}>📞 {order.vendor.phone}</p>}
          </section>
        )}

        {/* Delivery address */}
        {order.delivery_address && (
          <section style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>Delivery Address</h3>
            <p style={{ margin: 0, fontSize: 14, color: '#444', lineHeight: 1.6 }}>
              {[order.delivery_address.street, order.delivery_address.area, order.delivery_address.city].filter(Boolean).join(', ')}
            </p>
          </section>
        )}

        {/* Order items */}
        <section style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Items Ordered</h3>
          {order.items.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 14 }}>
              <span style={{ color: '#444' }}>{item.menu_item?.name ?? 'Unknown item'} <span style={{ color: '#aaa' }}>× {item.quantity}</span></span>
              <span style={{ fontWeight: 600 }}>₦{item.total_price.toLocaleString()}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12, marginTop: 4 }}>
            {[
              { label: 'Subtotal', value: order.subtotal },
              { label: 'Tax', value: order.tax_amount },
              { label: 'Delivery Fee', value: order.delivery_fee },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#888', marginBottom: 6 }}>
                <span>{label}</span><span>₦{Number(value).toLocaleString()}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16, marginTop: 8 }}>
              <span>Total</span>
              <span style={{ color: '#ff6b35' }}>₦{Number(order.total_amount).toLocaleString()}</span>
            </div>
          </div>
        </section>

        {/* Payment status */}
        <section style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#444' }}>Payment</span>
            <span style={{
              background: order.payment_status === 'completed' ? '#dcfce7' : order.payment_status === 'failed' ? '#fee2e2' : '#fef3c7',
              color: order.payment_status === 'completed' ? '#16a34a' : order.payment_status === 'failed' ? '#dc2626' : '#92400e',
              padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600, textTransform: 'capitalize',
            }}>
              {order.payment_status}
            </span>
          </div>
        </section>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Link to="/orders" style={{ color: '#888', fontSize: 14, textDecoration: 'none' }}>← View all orders</Link>
        </div>
      </div>
    </div>
  );
};

export default OrderTracking;
