import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface OrderSummary {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total_amount: number;
  created_at: string;
  vendor: { name: string } | null;
  item_count: number;
  reviewed?: boolean;
}

interface ReviewForm {
  orderId: string;
  vendorId: string;
  rating: number;
  comment: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending:           { bg: '#fef3c7', text: '#92400e' },
  confirmed:         { bg: '#dbeafe', text: '#1d4ed8' },
  preparing:         { bg: '#ede9fe', text: '#6d28d9' },
  ready_for_pickup:  { bg: '#cffafe', text: '#0e7490' },
  picked_up:         { bg: '#ffedd5', text: '#c2410c' },
  delivered:         { bg: '#dcfce7', text: '#16a34a' },
  cancelled:         { bg: '#fee2e2', text: '#dc2626' },
};

const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up'];

const OrderHistory = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewForm, setReviewForm] = useState<ReviewForm | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchOrders();
  }, [user]);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select(`
        id, order_number, status, payment_status, total_amount, created_at, vendor_id,
        vendor:vendors(name),
        items:order_items(id)
      `)
      .eq('customer_id', user!.id)
      .order('created_at', { ascending: false });

    if (data) {
      // Check which orders have reviews
      const orderIds = data.filter(o => o.status === 'delivered').map(o => o.id);
      let reviewedIds = new Set<string>();
      if (orderIds.length) {
        const { data: reviews } = await supabase
          .from('reviews')
          .select('order_id')
          .in('order_id', orderIds)
          .eq('customer_id', user!.id);
        reviewedIds = new Set((reviews ?? []).map(r => r.order_id));
      }

      setOrders(data.map(o => ({
        ...o,
        item_count: (o.items ?? []).length,
        vendor: Array.isArray(o.vendor) ? o.vendor[0] ?? null : o.vendor,
        reviewed: reviewedIds.has(o.id),
      })));
    }
    setLoading(false);
  };

  const submitReview = async () => {
    if (!reviewForm || !user) return;
    setSubmitLoading(true);
    setSubmitError(null);

    const { error } = await supabase.from('reviews').insert({
      customer_id: user.id,
      vendor_id: reviewForm.vendorId,
      order_id: reviewForm.orderId,
      rating: reviewForm.rating,
      comment: reviewForm.comment || null,
    });

    if (error) {
      setSubmitError(error.message);
      setSubmitLoading(false);
      return;
    }

    setOrders(prev => prev.map(o => o.id === reviewForm.orderId ? { ...o, reviewed: true } : o));
    setReviewForm(null);
    setReviewSuccess('Review submitted! Thank you.');
    setSubmitLoading(false);
    setTimeout(() => setReviewSuccess(null), 3000);
  };

  if (!user) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif', gap: 12 }}>
      <p>Please sign in to view your orders.</p>
      <Link to="/auth" style={{ color: '#ff6b35', fontWeight: 600 }}>Sign In</Link>
    </div>
  );

  const activeOrders = orders.filter(o => ACTIVE_STATUSES.includes(o.status));
  const pastOrders = orders.filter(o => !ACTIVE_STATUSES.includes(o.status));

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <header style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 50 }}>
        <button onClick={() => navigate('/restaurants')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#555' }}>←</button>
        <span style={{ fontSize: 18, fontWeight: 700 }}>My Orders</span>
      </header>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px' }}>
        {reviewSuccess && (
          <div style={{ background: '#dcfce7', color: '#16a34a', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontWeight: 600, fontSize: 14 }}>
            ✅ {reviewSuccess}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#888' }}>
            <p>Loading orders…</p>
          </div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#888' }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>🍽️</div>
            <h3 style={{ margin: '0 0 8px', color: '#444' }}>No orders yet</h3>
            <p style={{ margin: '0 0 20px' }}>Start exploring restaurants and place your first order!</p>
            <Link to="/restaurants" style={{ background: '#ff6b35', color: '#fff', textDecoration: 'none', padding: '12px 24px', borderRadius: 10, fontWeight: 700 }}>
              Browse Restaurants
            </Link>
          </div>
        ) : (
          <>
            {activeOrders.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' }}>Active Orders</h2>
                {activeOrders.map(order => <OrderCard key={order.id} order={order} onTrack={() => navigate(`/orders/${order.id}`)} onReview={null} />)}
              </div>
            )}

            {pastOrders.length > 0 && (
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' }}>Past Orders</h2>
                {pastOrders.map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onTrack={() => navigate(`/orders/${order.id}`)}
                    onReview={order.status === 'delivered' && !order.reviewed
                      ? (vendorId: string) => setReviewForm({ orderId: order.id, vendorId, rating: 5, comment: '' })
                      : null
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Review modal */}
      {reviewForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 420, width: '100%' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>Rate your order</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#888' }}>How was your experience?</p>

            {/* Star rating */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setReviewForm(prev => prev ? { ...prev, rating: star } : null)}
                  style={{ background: 'none', border: 'none', fontSize: 32, cursor: 'pointer', opacity: star <= reviewForm.rating ? 1 : 0.3, transition: 'opacity 0.1s' }}
                >
                  ⭐
                </button>
              ))}
            </div>

            <textarea
              placeholder="Tell us about your experience (optional)…"
              value={reviewForm.comment}
              onChange={e => setReviewForm(prev => prev ? { ...prev, comment: e.target.value } : null)}
              rows={4}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', resize: 'none', fontFamily: 'inherit', marginBottom: 16 }}
            />

            {submitError && <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 12px' }}>{submitError}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setReviewForm(null)} style={{ flex: 1, padding: '11px 0', border: '1px solid #ddd', borderRadius: 10, background: '#fff', cursor: 'pointer', fontSize: 14 }}>
                Cancel
              </button>
              <button onClick={submitReview} disabled={submitLoading} style={{ flex: 1, padding: '11px 0', border: 'none', borderRadius: 10, background: '#ff6b35', color: '#fff', cursor: submitLoading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14, opacity: submitLoading ? 0.7 : 1 }}>
                {submitLoading ? 'Submitting…' : 'Submit Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface OrderCardProps {
  order: OrderSummary;
  onTrack: () => void;
  onReview: ((vendorId: string) => void) | null;
}

const OrderCard = ({ order, onTrack, onReview }: OrderCardProps) => {
  const statusStyle = STATUS_COLORS[order.status] ?? { bg: '#f3f4f6', text: '#374151' };
  const isActive = ACTIVE_STATUSES.includes(order.status);

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 20, marginBottom: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: isActive ? '2px solid #ff6b35' : '1px solid #f0f0f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 15, color: '#1a1a1a' }}>
            {order.vendor?.name ?? 'Restaurant'}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>
            Order #{order.order_number} · {new Date(order.created_at).toLocaleDateString()}
          </p>
        </div>
        <span style={{ background: statusStyle.bg, color: statusStyle.text, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, textTransform: 'capitalize', flexShrink: 0 }}>
          {order.status.replace(/_/g, ' ')}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <span style={{ fontSize: 14, color: '#666' }}>{order.item_count} item{order.item_count !== 1 ? 's' : ''}</span>
        <span style={{ fontWeight: 700, fontSize: 16, color: '#ff6b35' }}>₦{Number(order.total_amount).toLocaleString()}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button onClick={onTrack} style={{ flex: 1, padding: '9px 0', border: '1px solid #ff6b35', borderRadius: 10, background: '#fff', color: '#ff6b35', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
          {isActive ? '📡 Track Order' : 'View Details'}
        </button>
        {onReview && (
          <button
            onClick={() => onReview((order as any).vendor_id ?? '')}
            style={{ flex: 1, padding: '9px 0', border: 'none', borderRadius: 10, background: '#ff6b35', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
          >
            ⭐ Leave Review
          </button>
        )}
        {order.status === 'delivered' && order.reviewed && (
          <span style={{ flex: 1, textAlign: 'center', padding: '9px 0', fontSize: 13, color: '#16a34a', fontWeight: 600 }}>✅ Reviewed</span>
        )}
      </div>
    </div>
  );
};

export default OrderHistory;
