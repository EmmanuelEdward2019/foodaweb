import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

type PaymentState = 'checking' | 'success' | 'pending' | 'failed';

const PaymentCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<PaymentState>('checking');
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    const reference = searchParams.get('reference') ?? searchParams.get('trxref');
    if (!reference) { setState('failed'); return; }

    let attempts = 0;
    const maxAttempts = 8;

    const check = async () => {
      attempts++;
      const { data } = await supabase
        .from('orders')
        .select('id, payment_status')
        .eq('payment_reference', reference)
        .single();

      if (data) {
        setOrderId(data.id);
        if (data.payment_status === 'completed') {
          setState('success');
          return;
        }
        if (data.payment_status === 'failed') {
          setState('failed');
          return;
        }
      }

      // Payment webhook may not have fired yet — keep polling
      if (attempts < maxAttempts) {
        setTimeout(check, 2000);
      } else {
        // After all attempts, still not confirmed — show pending state
        setState('pending');
      }
    };

    check();
  }, []);

  const config: Record<PaymentState, { icon: string; title: string; subtitle: string; color: string }> = {
    checking: { icon: '⏳', title: 'Verifying payment…', subtitle: 'Please wait while we confirm your payment', color: '#8b5cf6' },
    success:  { icon: '🎉', title: 'Payment Successful!', subtitle: 'Your order has been placed and the restaurant has been notified.', color: '#16a34a' },
    pending:  { icon: '⏰', title: 'Payment Processing', subtitle: 'Your payment is being processed. You will receive a confirmation shortly. Check your orders for updates.', color: '#f59e0b' },
    failed:   { icon: '❌', title: 'Payment Failed', subtitle: 'Your payment could not be verified. No charges were made. Please try again.', color: '#dc2626' },
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

        {(state === 'pending' || state === 'failed') && (
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
