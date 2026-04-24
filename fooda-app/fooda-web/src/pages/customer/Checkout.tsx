import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';

interface DeliveryAddress {
  street: string;
  area: string;
  city: string;
  phone: string;
  notes: string;
}

const Checkout = () => {
  const { id: vendorId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, subtotal, itemCount, vendorName, clearCart } = useCart();

  const [address, setAddress] = useState<DeliveryAddress>({ street: '', area: '', city: '', phone: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taxRate, setTaxRate] = useState(0.075);
  const [deliveryFee, setDeliveryFee] = useState(500);

  useEffect(() => {
    supabase
      .from('platform_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['tax_rate', 'delivery_fee'])
      .then(({ data }) => {
        (data ?? []).forEach(s => {
          if (s.setting_key === 'tax_rate') setTaxRate(parseFloat(s.setting_value));
          if (s.setting_key === 'delivery_fee') setDeliveryFee(parseFloat(s.setting_value));
        });
      });
  }, []);

  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount + deliveryFee;

  const handleField = (field: keyof DeliveryAddress, value: string) =>
    setAddress(prev => ({ ...prev, [field]: value }));

  const handlePlaceOrder = async () => {
    if (!user) { navigate('/auth'); return; }
    if (!address.street || !address.city || !address.phone) {
      setError('Please fill in your street address, city, and phone number.');
      return;
    }
    if (items.length === 0) { navigate('/restaurants'); return; }

    setLoading(true);
    setError(null);

    try {
      // Call the create-order edge function
      const { data, error: fnErr } = await supabase.functions.invoke('create-order', {
        body: {
          vendor_id: vendorId,
          items: items.map(i => ({ menu_item_id: i.menuItemId, quantity: i.quantity })),
          delivery_address: { street: address.street, area: address.area, city: address.city },
          notes: address.notes || null,
        },
      });

      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);

      const orderId = data?.order?.id;
      if (!orderId) throw new Error('Order creation failed — no order ID returned');

      // Initiate Paystack payment
      const { data: payData, error: payErr } = await supabase.functions.invoke('process-payment', {
        body: {
          order_id: orderId,
          amount: total,
          email: user.email,
          callback_url: `${window.location.origin}/payment/callback`,
        },
      });

      if (payErr) throw new Error(payErr.message);
      if (payData?.error) throw new Error(payData.error);

      clearCart();

      if (payData?.payment_url) {
        window.location.href = payData.payment_url;
      } else {
        navigate(`/orders/${orderId}`);
      }
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  if (itemCount === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif', gap: 16 }}>
        <div style={{ fontSize: 48 }}>🛒</div>
        <h2 style={{ margin: 0 }}>Your cart is empty</h2>
        <Link to="/restaurants" style={{ color: '#ff6b35', textDecoration: 'none', fontWeight: 600 }}>Browse Restaurants</Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <header style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 50 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#555' }}>←</button>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>Checkout</span>
      </header>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '28px 24px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 24 }}>
        {/* Left: Address form */}
        <div>
          <section style={{ background: '#fff', borderRadius: 16, padding: 24, marginBottom: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 700 }}>Delivery Address</h2>

            {[
              { label: 'Street Address *', field: 'street', placeholder: '12 Adeola Odeku Street', required: true },
              { label: 'Area / Neighbourhood', field: 'area', placeholder: 'Victoria Island' },
              { label: 'City *', field: 'city', placeholder: 'Lagos', required: true },
              { label: 'Phone Number *', field: 'phone', placeholder: '+234 800 000 0000', required: true },
            ].map(({ label, field, placeholder, required }) => (
              <div key={field} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#444' }}>{label}</label>
                <input
                  type={field === 'phone' ? 'tel' : 'text'}
                  placeholder={placeholder}
                  value={address[field as keyof DeliveryAddress]}
                  onChange={e => handleField(field as keyof DeliveryAddress, e.target.value)}
                  required={required}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            ))}

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#444' }}>Delivery Notes (optional)</label>
              <textarea
                placeholder="Gate code, landmark, floor number..."
                value={address.notes}
                onChange={e => handleField('notes', e.target.value)}
                rows={3}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 15, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
          </section>

          {!user && (
            <section style={{ background: '#fff3e0', borderRadius: 16, padding: 20, border: '1px solid #ffcc80', display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 24 }}>👤</span>
              <div>
                <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 14 }}>Sign in to continue</p>
                <p style={{ margin: 0, fontSize: 13, color: '#666' }}>You need an account to place an order and track deliveries.</p>
              </div>
              <Link to="/auth" style={{ background: '#ff6b35', color: '#fff', textDecoration: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13, flexShrink: 0 }}>Sign In</Link>
            </section>
          )}
        </div>

        {/* Right: Order summary */}
        <div style={{ position: 'sticky', top: 80, alignSelf: 'start' }}>
          <section style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700 }}>Order Summary</h2>
            {vendorName && <p style={{ margin: '0 0 16px', fontSize: 13, color: '#888' }}>From: <strong style={{ color: '#444' }}>{vendorName}</strong></p>}

            <div style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 16, marginBottom: 16 }}>
              {items.map(item => (
                <div key={item.menuItemId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 14 }}>
                  <span style={{ color: '#444' }}>{item.name} <span style={{ color: '#aaa' }}>× {item.quantity}</span></span>
                  <span style={{ fontWeight: 600, color: '#1a1a1a' }}>₦{(item.price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>

            {[
              { label: 'Subtotal', value: subtotal },
              { label: `Tax (${(taxRate * 100).toFixed(1)}%)`, value: taxAmount },
              { label: 'Delivery Fee', value: deliveryFee },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14, color: '#666' }}>
                <span>{label}</span>
                <span>₦{value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #f0f0f0', paddingTop: 12, marginTop: 4, fontWeight: 700, fontSize: 17 }}>
              <span>Total</span>
              <span style={{ color: '#ff6b35' }}>₦{Math.round(total).toLocaleString()}</span>
            </div>

            {error && (
              <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginTop: 16 }}>{error}</div>
            )}

            <button
              onClick={handlePlaceOrder}
              disabled={loading || !user}
              style={{
                width: '100%',
                marginTop: 20,
                padding: '14px 0',
                background: loading || !user ? '#ccc' : '#ff6b35',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 16,
                cursor: loading || !user ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {loading ? 'Processing…' : `Pay ₦${Math.round(total).toLocaleString()} via Paystack`}
            </button>

            <p style={{ textAlign: 'center', fontSize: 12, color: '#aaa', marginTop: 12 }}>🔒 Secured by Paystack</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
