import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';

interface VendorCard {
  id: string;
  name: string;
  description?: string;
  logo_url?: string;
  cover_image_url?: string;
  address?: { city?: string; area?: string };
}

const NAV_STYLE: React.CSSProperties = {
  background: '#fff',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  padding: '12px 24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  position: 'sticky',
  top: 0,
  zIndex: 50,
};

const CustomerNav = () => {
  const { user, signOut } = useAuth();
  const { itemCount, vendorId } = useCart();
  const navigate = useNavigate();

  return (
    <header style={NAV_STYLE}>
      <Link to="/restaurants" style={{ fontSize: 24, fontWeight: 800, color: '#ff6b35', textDecoration: 'none' }}>
        Fooda
      </Link>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        {user ? (
          <>
            <Link to="/orders" style={{ color: '#555', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>My Orders</Link>
            <Link to="/profile" style={{ color: '#555', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>Profile</Link>
            <button onClick={signOut} style={{ background: 'none', border: '1px solid #ddd', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, color: '#666' }}>Sign Out</button>
          </>
        ) : (
          <Link to="/auth" style={{ background: '#ff6b35', color: '#fff', padding: '8px 18px', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
            Sign In
          </Link>
        )}
        {itemCount > 0 && vendorId && (
          <button
            onClick={() => navigate(`/restaurants/${vendorId}/checkout`)}
            style={{ background: '#ff6b35', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600 }}
          >
            🛒 {itemCount}
          </button>
        )}
      </div>
    </header>
  );
};

export { CustomerNav };

const RestaurantList = () => {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<VendorCard[]>([]);
  const [filtered, setFiltered] = useState<VendorCard[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('vendors')
      .select('id, name, description, logo_url, cover_image_url, address')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        setVendors(data ?? []);
        setFiltered(data ?? []);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const q = search.toLowerCase().trim();
    if (!q) { setFiltered(vendors); return; }
    setFiltered(vendors.filter(v =>
      v.name.toLowerCase().includes(q) ||
      (v.description ?? '').toLowerCase().includes(q) ||
      (v.address?.area ?? '').toLowerCase().includes(q) ||
      (v.address?.city ?? '').toLowerCase().includes(q)
    ));
  }, [search, vendors]);

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <CustomerNav />

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)', padding: '48px 24px', textAlign: 'center' }}>
        <h1 style={{ color: '#fff', fontSize: 36, fontWeight: 800, margin: '0 0 8px' }}>Order food near you</h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', marginBottom: 28, fontSize: 16 }}>Choose from our best restaurants</p>
        <div style={{ maxWidth: 500, margin: '0 auto', position: 'relative' }}>
          <input
            type="text"
            placeholder="Search restaurants or cuisines..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '14px 52px 14px 18px', borderRadius: 12, border: 'none', fontSize: 16, outline: 'none', boxSizing: 'border-box', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}
          />
          <span style={{ position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)', fontSize: 20 }}>🔍</span>
        </div>
      </div>

      {/* Restaurant grid */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#888' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🍽️</div>
            <p>Loading restaurants…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#888' }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>😕</div>
            <h3 style={{ margin: '0 0 8px' }}>No restaurants found</h3>
            <p style={{ margin: 0 }}>{search ? `No results for "${search}"` : 'No restaurants available right now'}</p>
          </div>
        ) : (
          <>
            <p style={{ color: '#888', marginBottom: 24, fontSize: 14 }}>
              {filtered.length} restaurant{filtered.length !== 1 ? 's' : ''} {search ? `matching "${search}"` : 'available'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
              {filtered.map(v => (
                <div
                  key={v.id}
                  onClick={() => navigate(`/restaurants/${v.id}`)}
                  style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', transition: 'transform 0.15s, box-shadow 0.15s' }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.transform = 'translateY(-3px)'; el.style.boxShadow = '0 8px 28px rgba(0,0,0,0.12)'; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.transform = 'none'; el.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'; }}
                >
                  <div style={{
                    height: 160,
                    background: v.cover_image_url
                      ? `url(${v.cover_image_url}) center/cover`
                      : 'linear-gradient(135deg, #ff6b35, #f7931e)',
                    position: 'relative',
                  }}>
                    {v.logo_url && (
                      <img
                        src={v.logo_url}
                        alt={v.name}
                        style={{ position: 'absolute', bottom: -22, left: 16, width: 56, height: 56, borderRadius: '50%', border: '3px solid #fff', objectFit: 'cover', background: '#fff' }}
                      />
                    )}
                  </div>
                  <div style={{ padding: `${v.logo_url ? 32 : 16}px 16px 16px` }}>
                    <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: '#1a1a1a' }}>{v.name}</h3>
                    {v.description && (
                      <p style={{ margin: '0 0 8px', fontSize: 13, color: '#666', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                        {v.description}
                      </p>
                    )}
                    {(v.address?.area || v.address?.city) && (
                      <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>
                        📍 {[v.address?.area, v.address?.city].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RestaurantList;
