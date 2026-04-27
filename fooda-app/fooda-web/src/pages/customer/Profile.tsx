import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  avatar_url?: string;
}

interface UserAddress {
  id: string;
  label: string;
  street: string;
  area?: string;
  city: string;
  is_default: boolean;
}

interface Stats {
  totalOrders: number;
  totalSpent: number;
  reviewsGiven: number;
}

const Profile = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [stats, setStats] = useState<Stats>({ totalOrders: 0, totalSpent: 0, reviewsGiven: 0 });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [addrForm, setAddrForm] = useState({ label: 'Home', street: '', area: '', city: '' });
  const [addrSaving, setAddrSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('users').select('id, full_name, email, phone, avatar_url').eq('id', user.id).single(),
      supabase.from('user_addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false }),
      supabase.from('orders').select('total_amount, payment_status').eq('customer_id', user.id),
      supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('customer_id', user.id),
    ]).then(([{ data: p }, { data: a }, { data: orders }, { count: reviewCount }]) => {
      if (p) { setProfile(p); setForm({ full_name: p.full_name ?? '', phone: p.phone ?? '' }); }
      setAddresses(a ?? []);
      const completed = (orders ?? []).filter(o => o.payment_status === 'completed');
      setStats({
        totalOrders: (orders ?? []).length,
        totalSpent: completed.reduce((sum, o) => sum + Number(o.total_amount), 0),
        reviewsGiven: reviewCount ?? 0,
      });
      setLoading(false);
    });
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true); setError(null);
    const { error: err } = await supabase.from('users').update({ full_name: form.full_name, phone: form.phone }).eq('id', user.id);
    if (err) { setError(err.message); setSaving(false); return; }
    setProfile(prev => prev ? { ...prev, ...form } : null);
    setEditing(false);
    setSuccess('Profile updated!');
    setSaving(false);
    setTimeout(() => setSuccess(null), 3000);
  };

  const addAddress = async () => {
    if (!user) return;
    if (!addrForm.street || !addrForm.city) { setError('Street and city are required'); return; }
    setAddrSaving(true);
    const isFirst = addresses.length === 0;
    const { data, error: err } = await supabase.from('user_addresses').insert({
      user_id: user.id,
      label: addrForm.label,
      street: addrForm.street,
      area: addrForm.area || null,
      city: addrForm.city,
      is_default: isFirst,
    }).select().single();
    if (err) { setError(err.message); setAddrSaving(false); return; }
    setAddresses(prev => [...prev, data]);
    setShowAddAddress(false);
    setAddrForm({ label: 'Home', street: '', area: '', city: '' });
    setAddrSaving(false);
  };

  const deleteAddress = async (id: string) => {
    await supabase.from('user_addresses').delete().eq('id', id);
    setAddresses(prev => prev.filter(a => a.id !== id));
  };

  const setDefault = async (id: string) => {
    await supabase.from('user_addresses').update({ is_default: false }).eq('user_id', user!.id);
    await supabase.from('user_addresses').update({ is_default: true }).eq('id', id);
    setAddresses(prev => prev.map(a => ({ ...a, is_default: a.id === id })));
  };

  if (!user) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif', gap: 12 }}>
      <p>Please sign in to view your profile.</p>
      <Link to="/auth" style={{ color: '#ff6b35', fontWeight: 600 }}>Sign In</Link>
    </div>
  );

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif', color: '#888' }}>
      <p>Loading profile…</p>
    </div>
  );

  const fmtCurrency = (n: number) =>
    '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <header style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 50 }}>
        <button onClick={() => navigate('/restaurants')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#555' }}>←</button>
        <span style={{ fontSize: 18, fontWeight: 700 }}>My Profile</span>
      </header>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 20px' }}>
        {success && <div style={{ background: '#dcfce7', color: '#16a34a', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 14, fontWeight: 600 }}>✅ {success}</div>}
        {error && <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 14 }}>{error}</div>}

        {/* Stats row */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Orders', value: stats.totalOrders, icon: '📦' },
            { label: 'Total Spent', value: fmtCurrency(stats.totalSpent), icon: '💳' },
            { label: 'Reviews Given', value: stats.reviewsGiven, icon: '⭐' },
          ].map(({ label, value, icon }) => (
            <div key={label} style={{ background: '#fff', borderRadius: 14, padding: '16px 12px', textAlign: 'center', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1a1a', marginBottom: 2 }}>{value}</div>
              <div style={{ fontSize: 11, color: '#888', fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </section>

        {/* Profile info */}
        <section style={{ background: '#fff', borderRadius: 16, padding: 24, marginBottom: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
          {/* Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #ff6b35, #f7931e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#fff', fontWeight: 700 }}>
              {(profile?.full_name?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 17, color: '#1a1a1a' }}>{profile?.full_name || 'No name set'}</p>
              <p style={{ margin: 0, fontSize: 13, color: '#888' }}>{user.email}</p>
            </div>
          </div>

          {editing ? (
            <div>
              {[
                { label: 'Full Name', key: 'full_name', placeholder: 'Your full name', type: 'text' },
                { label: 'Phone Number', key: 'phone', placeholder: '+234 800 000 0000', type: 'tel' },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key} style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 5 }}>{label}</label>
                  <input
                    type={type}
                    value={form[key as keyof typeof form]}
                    placeholder={placeholder}
                    onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setEditing(false); setError(null); }} style={{ flex: 1, padding: '10px 0', border: '1px solid #ddd', borderRadius: 10, background: '#fff', cursor: 'pointer', fontSize: 14 }}>
                  Cancel
                </button>
                <button onClick={saveProfile} disabled={saving} style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: 10, background: '#ff6b35', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14 }}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              {[
                { label: 'Full Name', value: profile?.full_name || '—' },
                { label: 'Email', value: user.email ?? '—' },
                { label: 'Phone', value: profile?.phone || '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f9f9f9', fontSize: 14 }}>
                  <span style={{ color: '#888' }}>{label}</span>
                  <span style={{ color: '#1a1a1a', fontWeight: 500 }}>{value}</span>
                </div>
              ))}
              <button onClick={() => { setEditing(true); setError(null); }} style={{ marginTop: 16, background: '#fff', border: '1px solid #ff6b35', color: '#ff6b35', borderRadius: 10, padding: '9px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                Edit Profile
              </button>
            </div>
          )}
        </section>

        {/* Saved addresses */}
        <section style={{ background: '#fff', borderRadius: 16, padding: 24, marginBottom: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Saved Addresses</h3>
            <button onClick={() => setShowAddAddress(true)} style={{ background: '#ff6b35', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              + Add
            </button>
          </div>

          {addresses.length === 0 ? (
            <p style={{ color: '#aaa', fontSize: 14, margin: 0, textAlign: 'center', padding: '20px 0' }}>No saved addresses yet</p>
          ) : (
            addresses.map(addr => (
              <div key={addr.id} style={{ border: `1px solid ${addr.is_default ? '#ff6b35' : '#f0f0f0'}`, borderRadius: 12, padding: 14, marginBottom: 10, position: 'relative' }}>
                {addr.is_default && <span style={{ position: 'absolute', top: 10, right: 10, background: '#ff6b35', color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>DEFAULT</span>}
                <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14, color: '#1a1a1a' }}>{addr.label}</p>
                <p style={{ margin: '0 0 10px', fontSize: 13, color: '#666' }}>
                  {[addr.street, addr.area, addr.city].filter(Boolean).join(', ')}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  {!addr.is_default && (
                    <button onClick={() => setDefault(addr.id)} style={{ fontSize: 12, padding: '5px 10px', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', background: '#fff', color: '#555' }}>
                      Set as Default
                    </button>
                  )}
                  <button onClick={() => deleteAddress(addr.id)} style={{ fontSize: 12, padding: '5px 10px', border: '1px solid #fee2e2', borderRadius: 6, cursor: 'pointer', background: '#fff', color: '#dc2626' }}>
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}

          {/* Add address form */}
          {showAddAddress && (
            <div style={{ border: '2px dashed #f0f0f0', borderRadius: 12, padding: 16, marginTop: 10 }}>
              <h4 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>New Address</h4>
              {[
                { label: 'Label', key: 'label', placeholder: 'Home, Work, etc.' },
                { label: 'Street *', key: 'street', placeholder: '12 Adeola Odeku St.' },
                { label: 'Area', key: 'area', placeholder: 'Victoria Island' },
                { label: 'City *', key: 'city', placeholder: 'Lagos' },
              ].map(({ label, key, placeholder }) => (
                <div key={key} style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#444', marginBottom: 4 }}>{label}</label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={addrForm[key as keyof typeof addrForm]}
                    onChange={e => setAddrForm(prev => ({ ...prev, [key]: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => setShowAddAddress(false)} style={{ flex: 1, padding: '9px 0', border: '1px solid #ddd', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                <button onClick={addAddress} disabled={addrSaving} style={{ flex: 1, padding: '9px 0', border: 'none', borderRadius: 8, background: '#ff6b35', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                  {addrSaving ? 'Saving…' : 'Save Address'}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Quick links */}
        <section style={{ background: '#fff', borderRadius: 16, padding: '8px 0', marginBottom: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
          {[
            { label: '📦 My Orders', to: '/orders' },
            { label: '🔔 Notifications', to: '/notifications' },
            { label: '🍽️ Browse Restaurants', to: '/restaurants' },
          ].map(({ label, to }) => (
            <Link key={to} to={to} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', textDecoration: 'none', color: '#1a1a1a', borderBottom: '1px solid #f9f9f9', fontSize: 15 }}>
              <span>{label}</span>
              <span style={{ color: '#ccc' }}>›</span>
            </Link>
          ))}
        </section>

        <button
          onClick={async () => { await signOut(); navigate('/'); }}
          style={{ width: '100%', padding: '14px 0', border: '1px solid #fee2e2', borderRadius: 12, background: '#fff', color: '#dc2626', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default Profile;
