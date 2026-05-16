import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useCart } from '../../context/CartContext';

type PaymentState = 'checking' | 'success' | 'pending' | 'failed';

// Polling: 12 attempts × 2s = up to 24s while in 'checking', then we drop to
// 'pending' (still polling slower in the background). The webhook usually
// arrives within a few seconds, but Paystack signing failures or queue lag
// have been observed in the wild, so we keep checking.
const FAST_INTERVAL_MS = 2000;
const FAST_MAX_ATTEMPTS = 12;
const SLOW_INTERVAL_MS = 6000;
const SLOW_MAX_ATTEMPTS = 10;

const PaymentCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const [state, setState] = useState<PaymentState>('checking');
  const [orderId, setOrderId] = useState<string | null>(null);
  const cartCleared = useRef(false);
  const cancelled = useRef(false);
  const reference = searchParams.get('reference') ?? searchParams.get('trxref');

  const checkOnce = useCallback(async (): Promise<PaymentState> => {
    if (!reference) return 'failed';
    // 1) Cheap read first — if the webhook already updated the order we are done.
    const { data } = await supabase
      .from('orders')
      .select('id, payment_status')
      .eq('payment_reference', reference)
      .single();

    if (data) {
      setOrderId(data.id);
      if (data.payment_status === 'completed') return 'success';
      if (data.payment_status === 'failed')    return 'failed';
    }

    // 2) Webhook hasn't landed yet (or isn't configured). Ask Paystack directly
    //    via our verify-payment function and let it settle the order.
    try {
      const { data: verifyData } = await supabase.functions.invoke('verify-payment', {
        body: { reference },
      });
      if (verifyData?.order_id) setOrderId(verifyData.order_id);
      if (verifyData?.status === 'completed') return 'success';
      if (verifyData?.status === 'failed')    return 'failed';
    } catch {
      /* swallow — we'll poll again */
    }

    return 'pending';
  }, [reference]);

  const poll = useCallback(async () => {
    cancelled.current = false;
    setState('checking');

    // Fast pass
    for (let i = 0; i < FAST_MAX_ATTEMPTS; i++) {
      if (cancelled.current) return;
      const result = await checkOnce();
      if (result === 'success' || result === 'failed') {
        setState(result);
        if (result === 'success' && !cartCleared.current) {
          clearCart();
          sessionStorage.removeItem('fooda_pending_order');
          cartCleared.current = true;
        }
        return;
      }
      await new Promise(r => setTimeout(r, FAST_INTERVAL_MS));
    }

    // Slow pass — UI shows 'pending' but we still try
    setState('pending');
    for (let i = 0; i < SLOW_MAX_ATTEMPTS; i++) {
      if (cancelled.current) return;
      await new Promise(r => setTimeout(r, SLOW_INTERVAL_MS));
      const result = await checkOnce();
      if (result === 'success' || result === 'failed') {
        setState(result);
        if (result === 'success' && !cartCleared.current) {
          clearCart();
          sessionStorage.removeItem('fooda_pending_order');
          cartCleared.current = true;
        }
        return;
      }
    }
  }, [checkOnce, clearCart]);

  useEffect(() => {
    if (!reference) { setState('failed'); return; }
    poll();
    return () => { cancelled.current = true; };
  }, [reference, poll]);

  const handleRetry = () => {
    cancelled.current = true;
    setTimeout(() => poll(), 100);
  };

  const config: Record<PaymentState, { icon: string; title: string; subtitle: string; color: string }> = {
    checking: { icon: '⏳', title: 'Verifying payment…', subtitle: 'Please wait while we confirm your payment with Paystack.', color: '#8b5cf6' },
    success:  { icon: '🎉', title: 'Payment Successful!', subtitle: 'Your order has been placed and the restaurant has been notified.', color: '#16a34a' },
    pending:  { icon: '⏰', title: 'Still Processing', subtitle: 'Your payment is taking a little longer than usual. We will keep checking, and you can also re-check now or view your orders.', color: '#f59e0b' },
    failed:   { icon: '❌', title: 'Payment Failed', subtitle: 'Your payment could not be verified. If you were charged, the amount will be reversed automatically.', color: '#dc2626' },
  };

  const { icon, title, subtitle, color } = config[state];

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '48px 36px', maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>{icon}</div>
        <h1 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 800, color: '#1a1a1a' }}>{title}</h1>
        <p style={{ margin: '0 0 28px', fontSize: 15, color: '#666', lineHeight: 1.6 }}>{subtitle}</p>

        {state === 'checking' && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
            {[0, 1, 2].map(i => (
              <div
                key={i}
                style={{ width: 8, height: 8, borderRadius: '50%', background: color, animation: 'pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        )}

        {state === 'success' && orderId && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => navigate(`/orders/${orderId}`)}
              style={{ padding: '12px 0', background: '#ff6b35', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 15 }}
            >
              Track My Order
            </button>
            <Link to="/restaurants" style={{ color: '#888', fontSize: 14, textDecoration: 'none' }}>
              Continue Shopping
            </Link>
          </div>
        )}

        {state === 'pending' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={handleRetry}
              style={{ padding: '12px 0', background: '#ff6b35', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 15 }}
            >
              Check again
            </button>
            <Link to={orderId ? `/orders/${orderId}` : '/orders'} style={{ color: '#ff6b35', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
              {orderId ? 'View this order' : 'View My Orders'}
            </Link>
            <Link to="/restaurants" style={{ color: '#888', fontSize: 14, textDecoration: 'none' }}>
              Back to Restaurants
            </Link>
          </div>
        )}

        {state === 'failed' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Link to="/orders" style={{ display: 'block', padding: '12px 0', background: '#ff6b35', color: '#fff', textDecoration: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15 }}>
              View My Orders
            </Link>
            <Link to="/restaurants" style={{ color: '#888', fontSize: 14, textDecoration: 'none' }}>
              Back to Restaurants
            </Link>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default PaymentCallback;
