import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogOut, User as UserIcon, Package, Bell } from 'lucide-react';
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

interface ActiveOrder {
  id: string;
  order_number: string;
  status: string;
  vendor_name: string;
}

const ACTIVE_STATUS_LABEL: Record<string, string> = {
  pending:          'Waiting for confirmation',
  confirmed:        'Confirmed by restaurant',
  preparing:        'Being prepared',
  ready_for_pickup: 'Ready for pickup',
  picked_up:        'Out for delivery',
};

const Stars = ({ avg, count }: { avg: number; count: number }) => {
  const full = Math.round(avg);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12 }}>
      {[1,2,3,4,5].map(s => (
        <span key={s} style={{ color: s <= full ? '#f59e0b' : '#d1d5db', fontSize: 13 }}>★</span>
      ))}
      <span style={{ color: '#888', marginLeft: 2 }}>({count})</span>
    </div>
  );
};

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
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .then(({ count }) => setUnreadCount(count ?? 0));
  }, [user]);

  // Close dropdown on outside click / Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    await signOut();
    navigate('/');
  };

  return (
    <header style={NAV_STYLE}>
      <Link to="/restaurants" style={{ fontSize: 24, fontWeight: 800, color: '#ff6b35', textDecoration: 'none', letterSpacing: '-0.5px' }}>
        Fooda
      </Link>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {user ? (
          <>
            <Link to="/orders" style={{ color: '#555', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>Orders</Link>

            {/* Notification bell */}
            <Link to="/notifications" aria-label="Notifications" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', background: '#f8f9fa', textDecoration: 'none', color: '#555' }}>
              <Bell size={18} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: 0, right: 0,
                  background: '#dc2626', color: '#fff',
                  fontSize: 10, fontWeight: 700,
                  minWidth: 18, height: 18, borderRadius: 9,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 4px',
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            {/* Avatar + dropdown */}
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                aria-label="Account menu"
                aria-expanded={menuOpen}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #ff6b35, #f7931e)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: 14,
                  border: menuOpen ? '2px solid #ff6b35' : '2px solid transparent',
                  boxShadow: menuOpen ? '0 0 0 3px rgba(255,107,53,0.18)' : 'none',
                  cursor: 'pointer', flexShrink: 0, padding: 0,
                }}
              >
                {(user.email?.[0] ?? '?').toUpperCase()}
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  style={{
                    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                    minWidth: 220, background: '#fff',
                    borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.14)',
                    border: '1px solid #f0f0f0', padding: 6, zIndex: 100,
                  }}
                >
                  <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid #f5f5f5', marginBottom: 4 }}>
                    <p style={{ margin: 0, fontSize: 12, color: '#888' }}>Signed in as</p>
                    <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 600, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.email}
                    </p>
                  </div>
                  <MenuLink to="/profile" icon={<UserIcon size={16} />} label="Profile" onClick={() => setMenuOpen(false)} />
                  <MenuLink to="/orders" icon={<Package size={16} />} label="My Orders" onClick={() => setMenuOpen(false)} />
                  <MenuLink to="/notifications" icon={<Bell size={16} />} label="Notifications" onClick={() => setMenuOpen(false)} />
                  <div style={{ height: 1, background: '#f5f5f5', margin: '6px 4px' }} />
                  <button
                    onClick={handleLogout}
                    role="menuitem"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '9px 12px',
                      background: 'transparent', border: 'none', borderRadius: 8,
                      color: '#dc2626', fontWeight: 600, fontSize: 14,
                      cursor: 'pointer', textAlign: 'left',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2'}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
                  >
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
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

const MenuLink = ({ to, icon, label, onClick }: { to: string; icon: React.ReactNode; label: string; onClick: () => void }) => (
  <Link
    to={to}
    onClick={onClick}
    role="menuitem"
    style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 12px', borderRadius: 8,
      color: '#1a1a1a', textDecoration: 'none',
      fontSize: 14, fontWeight: 500,
    }}
    onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = '#f8f9fa'}
    onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'}
  >
    <span style={{ color: '#666' }}>{icon}</span> {label}
  </Link>
);

export { CustomerNav };

const RestaurantList = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [vendors, setVendors] = useState<VendorCard[]>([]);
  const [filtered, setFiltered] = useState<VendorCard[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [ratings, setRatings] = useState<Record<string, { avg: number; count: number }>>({});
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [recentVendors, setRecentVendors] = useState<VendorCard[]>([]);

  // Fetch vendors + ratings together
  useEffect(() => {
    Promise.all([
      supabase.from('vendors').select('id, name, description, logo_url, cover_image_url, address').eq('is_active', true).order('name'),
      supabase.from('reviews').select('vendor_id, rating'),
    ]).then(([{ data: vendorData }, { data: reviewData }]) => {
      const vList = vendorData ?? [];
      setVendors(vList);
      setFiltered(vList);

      const groups: Record<string, number[]> = {};
      (reviewData ?? []).forEach(r => {
        groups[r.vendor_id] = groups[r.vendor_id] ?? [];
        groups[r.vendor_id].push(r.rating);
      });
      const rMap: Record<string, { avg: number; count: number }> = {};
      Object.entries(groups).forEach(([id, rs]) => {
        rMap[id] = { avg: rs.reduce((a, b) => a + b, 0) / rs.length, count: rs.length };
      });
      setRatings(rMap);
      setLoading(false);
    });
  }, []);

  // Fetch user-specific data (active order + recent vendors)
  useEffect(() => {
    if (!user) return;

    supabase
      .from('orders')
      .select('id, order_number, status, vendors(name)')
      .eq('customer_id', user.id)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const vname = (Array.isArray(data.vendors) ? data.vendors[0] : data.vendors as any)?.name ?? 'Restaurant';
        setActiveOrder({ id: data.id, order_number: data.order_number, status: data.status, vendor_name: vname });
      });

    supabase
      .from('orders')
      .select('vendor_id, vendors(id, name, logo_url, cover_image_url, description, address)')
      .eq('customer_id', user.id)
      .eq('status', 'delivered')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        const seen = new Set<string>();
        const unique: VendorCard[] = [];
        (data ?? []).forEach((o: any) => {
          const v = Array.isArray(o.vendors) ? o.vendors[0] : o.vendors;
          if (v && !seen.has(v.id) && unique.length < 4) {
            seen.add(v.id);
            unique.push(v as VendorCard);
          }
        });
        setRecentVendors(unique);
      });
  }, [user]);

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

      {/* Active order banner */}
      {activeOrder && (
        <div style={{ background: '#fff7ed', borderBottom: '2px solid #fed7aa', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>📡</span>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#9a3412' }}>
                Active Order · {activeOrder.vendor_name}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: '#c2410c' }}>
                #{activeOrder.order_number} · {ACTIVE_STATUS_LABEL[activeOrder.status] ?? activeOrder.status.replace(/_/g, ' ')}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/orders/${activeOrder.id}`)}
            style={{ background: '#ff6b35', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 12, flexShrink: 0 }}
          >
            Track →
          </button>
        </div>
      )}

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)', padding: '40px 24px', textAlign: 'center' }}>
        {user && (
          <p style={{ color: 'rgba(255,255,255,0.9)', marginBottom: 6, fontSize: 15 }}>
            Hey, {user.email?.split('@')[0]} 👋
          </p>
        )}
        <h1 style={{ color: '#fff', fontSize: 30, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.5px' }}>
          {user ? 'What are you craving today?' : 'Order food near you'}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.82)', marginBottom: 24, fontSize: 14 }}>
          Fresh meals from the best local restaurants
        </p>
        <div style={{ maxWidth: 520, margin: '0 auto', position: 'relative' }}>
          <input
            type="text"
            placeholder="Search restaurants or cuisines…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="restaurant-search-input"
            style={{ width: '100%', padding: '13px 50px 13px 18px', borderRadius: 12, border: 'none', fontSize: 15, outline: 'none', boxSizing: 'border-box', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', color: '#222' }}
          />
          <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 18, opacity: 0.5 }}>🔍</span>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>

        {/* Order Again */}
        {recentVendors.length > 0 && !search && (
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1a1a1a', margin: '0 0 14px' }}>Order Again</h2>
            <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 6 }}>
              {recentVendors.map(v => (
                <div
                  key={v.id}
                  onClick={() => navigate(`/restaurants/${v.id}`)}
                  style={{ minWidth: 148, maxWidth: 148, cursor: 'pointer', flexShrink: 0, background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', transition: 'transform 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.transform = 'none'}
                >
                  <div style={{ height: 76, background: v.cover_image_url ? `url(${v.cover_image_url}) center/cover` : 'linear-gradient(135deg, #ff6b35, #f7931e)' }} />
                  <div style={{ padding: '10px 12px 12px' }}>
                    <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 12, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.name}</p>
                    {ratings[v.id] ? <Stars avg={ratings[v.id].avg} count={ratings[v.id].count} /> : <span style={{ fontSize: 11, color: '#aaa' }}>No reviews yet</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All restaurants */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#888' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🍽️</div>
            <p style={{ margin: 0 }}>Loading restaurants…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#888' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>😕</div>
            <h3 style={{ margin: '0 0 8px', color: '#444' }}>No restaurants found</h3>
            <p style={{ margin: 0 }}>{search ? `No results for "${search}"` : 'No restaurants available right now'}</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
                {search ? `Results for "${search}"` : 'All Restaurants'}
              </h2>
              <span style={{ color: '#aaa', fontSize: 13 }}>{filtered.length} available</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 22 }}>
              {filtered.map(v => (
                <div
                  key={v.id}
                  onClick={() => navigate(`/restaurants/${v.id}`)}
                  style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', transition: 'transform 0.15s, box-shadow 0.15s' }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.transform = 'translateY(-3px)'; el.style.boxShadow = '0 8px 28px rgba(0,0,0,0.11)'; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.transform = 'none'; el.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'; }}
                >
                  {/* Cover */}
                  <div style={{ height: 160, background: v.cover_image_url ? `url(${v.cover_image_url}) center/cover` : 'linear-gradient(135deg, #ff6b35, #f7931e)', position: 'relative' }}>
                    {v.logo_url && (
                      <img src={v.logo_url} alt={v.name}
                        style={{ position: 'absolute', bottom: -22, left: 16, width: 52, height: 52, borderRadius: '50%', border: '3px solid #fff', objectFit: 'cover', background: '#fff' }}
                      />
                    )}
                    {/* Rating badge top-right */}
                    {ratings[v.id] && (
                      <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.55)', color: '#fff', padding: '4px 9px', borderRadius: 20, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ color: '#f59e0b' }}>★</span>
                        {ratings[v.id].avg.toFixed(1)}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ padding: `${v.logo_url ? 30 : 16}px 16px 18px` }}>
                    <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>{v.name}</h3>

                    {ratings[v.id] ? (
                      <div style={{ marginBottom: 7 }}>
                        <Stars avg={ratings[v.id].avg} count={ratings[v.id].count} />
                      </div>
                    ) : (
                      <p style={{ margin: '0 0 7px', fontSize: 11, color: '#ccc' }}>No reviews yet</p>
                    )}

                    {v.description && (
                      <p style={{ margin: '0 0 8px', fontSize: 13, color: '#666', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, lineHeight: 1.45 }}>
                        {v.description}
                      </p>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                      {(v.address?.area || v.address?.city) && (
                        <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>
                          📍 {[v.address?.area, v.address?.city].filter(Boolean).join(', ')}
                        </p>
                      )}
                      <span style={{ fontSize: 12, color: '#ff6b35', fontWeight: 600, marginLeft: 'auto' }}>Order →</span>
                    </div>
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
