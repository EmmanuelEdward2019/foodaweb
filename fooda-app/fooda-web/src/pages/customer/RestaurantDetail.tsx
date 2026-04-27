import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { CustomerNav } from './RestaurantList';

interface Vendor {
  id: string;
  name: string;
  description?: string;
  logo_url?: string;
  cover_image_url?: string;
  address?: { street?: string; area?: string; city?: string };
  phone?: string;
  email?: string;
  business_hours?: Record<string, { open: string; close: string; closed?: boolean }>;
  is_active: boolean;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  sort_order: number;
}

interface MenuItem {
  id: string;
  category_id?: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  is_available: boolean;
  is_vegetarian: boolean;
  is_vegan: boolean;
  prep_time?: number;
}

interface Addon {
  id: string;
  menu_item_id: string;
  name: string;
  price: number;
}

interface Review {
  id: string;
  rating: number;
  comment?: string;
  created_at: string;
  reviewer?: { full_name?: string } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_LABELS: Record<string, string> = { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday' };

function getTodayStatus(hours?: Record<string, any>) {
  if (!hours) return null;
  const today = DAY_NAMES[new Date().getDay()];
  const h = hours[today];
  if (!h) return null;
  if (h.closed) return { isOpen: false, label: 'Closed today', today: null };
  const now = new Date();
  const cur = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const isOpen = cur >= h.open && cur <= h.close;
  return {
    isOpen,
    label: isOpen ? `Open · Closes ${h.close}` : `Closed · Opens ${h.open}`,
    today: `${h.open} – ${h.close}`,
  };
}

function StarDisplay({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span style={{ letterSpacing: 1 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <span key={s} style={{ color: s <= Math.round(rating) ? '#f59e0b' : '#d1d5db', fontSize: size }}>★</span>
      ))}
    </span>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <span key={s}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(s)}
          style={{ fontSize: 28, cursor: 'pointer', color: s <= (hover || value) ? '#f59e0b' : '#d1d5db', transition: 'color .1s' }}>
          ★
        </span>
      ))}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
const RestaurantDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem, items: cartItems, vendorId: cartVendorId, itemCount, subtotal, clearCart } = useCart();

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [addonsMap, setAddonsMap] = useState<Record<string, Addon[]>>({});
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showClearConfirm, setShowClearConfirm] = useState<{ item: MenuItem } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showHours, setShowHours] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reviews
  const [eligibleOrderId, setEligibleOrderId] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);

  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from('vendors').select('*').eq('id', id).single(),
      supabase.from('menu_categories').select('id, name, description, sort_order').eq('vendor_id', id).eq('is_active', true).order('sort_order'),
      supabase.from('menu_items').select('*').eq('vendor_id', id).eq('is_available', true).order('sort_order'),
      supabase.from('reviews').select('id, rating, comment, created_at, reviewer:users!customer_id(full_name)').eq('vendor_id', id).eq('is_verified', true).order('created_at', { ascending: false }).limit(20),
    ]).then(([{ data: v }, { data: cats }, { data: items }, { data: revs }]) => {
      setVendor(v);
      setCategories(cats ?? []);
      setMenuItems(items ?? []);
      setReviews((revs as any) ?? []);
      setLoading(false);

      // Set page title
      if (v) document.title = `${v.name} — Fooda`;

      // Fetch addons
      if (items && items.length > 0) {
        supabase.from('menu_item_addons')
          .select('id, menu_item_id, name, price')
          .in('menu_item_id', items.map(i => i.id))
          .eq('is_available', true)
          .then(({ data }) => {
            const map: Record<string, Addon[]> = {};
            (data ?? []).forEach((a: Addon) => {
              map[a.menu_item_id] = map[a.menu_item_id] ?? [];
              map[a.menu_item_id].push(a);
            });
            setAddonsMap(map);
          });
      }
    });
    return () => { document.title = 'Fooda'; };
  }, [id]);

  // Check if logged-in user is eligible to write a review
  useEffect(() => {
    if (!user || !id) return;
    supabase.from('orders')
      .select('id')
      .eq('customer_id', user.id)
      .eq('vendor_id', id)
      .eq('status', 'delivered')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (data) setEligibleOrderId(data.id); });
  }, [user, id]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleAddItem = (item: MenuItem) => {
    if (cartVendorId && cartVendorId !== id) { setShowClearConfirm({ item }); return; }
    addItem(id!, vendor!.name, { menuItemId: item.id, name: item.name, price: item.price, imageUrl: item.image_url ?? undefined });
    showToast(`${item.name} added to cart`);
  };

  const confirmClearAndAdd = (item: MenuItem) => {
    clearCart();
    addItem(id!, vendor!.name, { menuItemId: item.id, name: item.name, price: item.price, imageUrl: item.image_url ?? undefined });
    setShowClearConfirm(null);
    showToast(`Cart cleared. ${item.name} added`);
  };

  const cartQty = (itemId: string) => cartItems.find(i => i.menuItemId === itemId)?.quantity ?? 0;

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: vendor?.name, text: vendor?.description, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const submitReview = async () => {
    if (!user || !eligibleOrderId) return;
    setSubmittingReview(true);
    setReviewError('');
    const { error } = await supabase.from('reviews').insert({
      customer_id: user.id,
      vendor_id: id,
      order_id: eligibleOrderId,
      rating: reviewForm.rating,
      comment: reviewForm.comment || null,
      is_verified: false,
    });
    setSubmittingReview(false);
    if (error) {
      if (error.code === '23505') setReviewError('You have already submitted a review for this restaurant.');
      else setReviewError(error.message);
      return;
    }
    setReviewSuccess(true);
    setShowReviewForm(false);
  };

  // ─── Derived data ─────────────────────────────────────────────────────────
  const itemsByCategory: Record<string, MenuItem[]> = { all: menuItems };
  categories.forEach(cat => { itemsByCategory[cat.id] = menuItems.filter(i => i.category_id === cat.id); });
  const uncategorised = menuItems.filter(i => !i.category_id);
  if (uncategorised.length) itemsByCategory['uncategorised'] = uncategorised;

  const visibleCategories = [
    { id: 'all', name: 'All Items' },
    ...categories.filter(c => (itemsByCategory[c.id] ?? []).length > 0),
    ...(uncategorised.length ? [{ id: 'uncategorised', name: 'Other' }] : []),
  ];

  const scrollToCategory = (catId: string) => {
    setActiveCategory(catId);
    if (catId === 'all') { window.scrollTo({ top: 500, behavior: 'smooth' }); return; }
    categoryRefs.current[catId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const todayStatus = getTodayStatus(vendor?.business_hours);
  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
  const featuredItems = menuItems.slice(0, Math.min(6, menuItems.length));
  const displayedReviews = showAllReviews ? reviews : reviews.slice(0, 4);

  // ─── Loading / 404 ────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <CustomerNav />
      <div style={{ textAlign: 'center', padding: '80px 0', color: '#888' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🍽️</div>
        <p>Loading restaurant…</p>
      </div>
    </div>
  );

  if (!vendor) return (
    <div style={{ minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <CustomerNav />
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
        <h2 style={{ margin: '0 0 8px' }}>Restaurant not found</h2>
        <p style={{ color: '#888', margin: '0 0 20px' }}>This page may have moved or been removed.</p>
        <button onClick={() => navigate('/restaurants')} style={{ background: '#ff6b35', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
          Browse Restaurants
        </button>
      </div>
    </div>
  );

  // ─── Render helpers ────────────────────────────────────────────────────────
  const renderMenuSection = (catId: string, catName: string) => {
    const items = itemsByCategory[catId] ?? [];
    if (!items.length) return null;
    return (
      <div key={catId} ref={el => { categoryRefs.current[catId] = el; }} style={{ marginBottom: 36 }}>
        {catId !== 'all' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 16px', paddingTop: 8 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{catName}</h2>
            <span style={{ fontSize: 13, color: '#aaa' }}>{items.length} item{items.length !== 1 ? 's' : ''}</span>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {items.map(item => (
            <MenuItemCard
              key={item.id}
              item={item}
              addons={addonsMap[item.id] ?? []}
              qty={cartQty(item.id)}
              onAdd={() => handleAddItem(item)}
            />
          ))}
        </div>
      </div>
    );
  };

  // ─── Page render ──────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', fontFamily: 'Inter, system-ui, sans-serif', paddingBottom: itemCount > 0 ? 96 : 0 }}>
      <CustomerNav />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', height: 300, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: vendor.cover_image_url ? `url(${vendor.cover_image_url}) center/cover no-repeat` : 'linear-gradient(135deg, #ff6b35, #f7931e)',
        }} />
        {/* Gradient overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 100%)' }} />

        {/* Back button */}
        <button onClick={() => navigate('/restaurants')} style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(0,0,0,0.4)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 14, fontWeight: 500, backdropFilter: 'blur(4px)' }}>
          ← Back
        </button>

        {/* Share button */}
        <button onClick={share} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.4)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 14, backdropFilter: 'blur(4px)' }}>
          {copied ? '✓ Copied!' : '↗ Share'}
        </button>

        {/* Name + status at bottom */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 24px 20px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
            {vendor.logo_url && (
              <img src={vendor.logo_url} alt={vendor.name} style={{ width: 72, height: 72, borderRadius: 14, border: '3px solid #fff', objectFit: 'cover', background: '#fff', flexShrink: 0, marginBottom: -8 }} />
            )}
            <div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.4)', lineHeight: 1.2 }}>{vendor.name}</h1>
              {avgRating !== null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <StarDisplay rating={avgRating} size={13} />
                  <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>{avgRating.toFixed(1)} ({reviews.length} review{reviews.length !== 1 ? 's' : ''})</span>
                </div>
              )}
            </div>
          </div>
          {todayStatus && (
            <span style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, background: todayStatus.isOpen ? 'rgba(22,163,74,0.9)' : 'rgba(220,38,38,0.85)', color: '#fff', backdropFilter: 'blur(4px)', flexShrink: 0 }}>
              {todayStatus.isOpen ? '● Open' : '● Closed'}
            </span>
          )}
        </div>
      </div>

      {/* ── Info strip ────────────────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '14px 24px', display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          {vendor.address?.area || vendor.address?.city ? (
            <span style={{ fontSize: 13, color: '#666', display: 'flex', alignItems: 'center', gap: 5 }}>
              📍 {[vendor.address?.street, vendor.address?.area, vendor.address?.city].filter(Boolean).join(', ')}
            </span>
          ) : null}
          {vendor.phone && (
            <a href={`tel:${vendor.phone}`} style={{ fontSize: 13, color: '#666', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
              📞 {vendor.phone}
            </a>
          )}
          {vendor.email && (
            <a href={`mailto:${vendor.email}`} style={{ fontSize: 13, color: '#666', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
              ✉️ {vendor.email}
            </a>
          )}
          {todayStatus && (
            <button onClick={() => setShowHours(h => !h)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: todayStatus.isOpen ? '#16a34a' : '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              🕐 {todayStatus.label} {vendor.business_hours ? (showHours ? '▲' : '▾') : ''}
            </button>
          )}
        </div>

        {/* Business hours panel */}
        {showHours && vendor.business_hours && (
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 16px' }}>
            <div style={{ background: '#f8f9fa', borderRadius: 12, padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
              {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => {
                const h = vendor.business_hours![day];
                const isToday = DAY_NAMES[new Date().getDay()] === day;
                return h ? (
                  <div key={day} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 8, background: isToday ? '#fff7ed' : 'transparent', border: isToday ? '1px solid #fed7aa' : 'none' }}>
                    <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 400, color: isToday ? '#9a3412' : '#444' }}>{DAY_LABELS[day]}</span>
                    <span style={{ fontSize: 13, color: h.closed ? '#dc2626' : '#555', fontWeight: isToday ? 600 : 400 }}>{h.closed ? 'Closed' : `${h.open} – ${h.close}`}</span>
                  </div>
                ) : null;
              })}
            </div>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>

        {/* ── About ─────────────────────────────────────────────────────── */}
        {vendor.description && (
          <section style={{ padding: '24px 0 8px' }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 28, flexShrink: 0, marginTop: 2 }}>🍽️</span>
              <div>
                <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>About {vendor.name}</h3>
                <p style={{ margin: 0, fontSize: 14, color: '#555', lineHeight: 1.6 }}>{vendor.description}</p>
              </div>
            </div>
          </section>
        )}

        {/* ── Featured items strip ──────────────────────────────────────── */}
        {featuredItems.length > 0 && (
          <section style={{ padding: '24px 0 0' }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1a1a1a', margin: '0 0 14px' }}>Popular Items</h2>
            <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 6 }}>
              {featuredItems.map(item => (
                <div key={item.id} onClick={() => handleAddItem(item)}
                  style={{ minWidth: 160, maxWidth: 160, flexShrink: 0, background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 8px rgba(0,0,0,0.07)', cursor: 'pointer', border: '1px solid #f0f0f0' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'none'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 8px rgba(0,0,0,0.07)'; }}
                >
                  <div style={{ height: 110, background: item.image_url ? `url(${item.image_url}) center/cover` : 'linear-gradient(135deg, #fff7ed, #ffedd5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {!item.image_url && <span style={{ fontSize: 36 }}>🍴</span>}
                  </div>
                  <div style={{ padding: '10px 12px 12px' }}>
                    <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 13, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#ff6b35' }}>₦{Number(item.price).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Category tabs (sticky) ────────────────────────────────────── */}
        {visibleCategories.length > 1 && (
          <div style={{ position: 'sticky', top: 57, zIndex: 40, background: '#f8f9fa', paddingTop: 16, paddingBottom: 0, marginLeft: -24, marginRight: -24, paddingLeft: 24, paddingRight: 24 }}>
            <div style={{ background: '#fff', borderRadius: '12px 12px 0 0', borderBottom: '1px solid #f0f0f0', overflowX: 'auto' }}>
              <div style={{ display: 'flex', gap: 0, padding: '0 8px', whiteSpace: 'nowrap' }}>
                {visibleCategories.map(cat => (
                  <button key={cat.id} onClick={() => scrollToCategory(cat.id)}
                    style={{ padding: '14px 18px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: activeCategory === cat.id ? 700 : 500, color: activeCategory === cat.id ? '#ff6b35' : '#555', borderBottom: activeCategory === cat.id ? '2px solid #ff6b35' : '2px solid transparent', transition: 'all 0.15s' }}>
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Full menu ─────────────────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: visibleCategories.length > 1 ? '0 0 16px 16px' : 16, padding: '24px', marginBottom: 28, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
          {activeCategory === 'all'
            ? (
              <>
                {categories.filter(c => (itemsByCategory[c.id] ?? []).length > 0).map(c => renderMenuSection(c.id, c.name))}
                {uncategorised.length > 0 && renderMenuSection('uncategorised', 'Other')}
                {menuItems.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🍽️</div>
                    <p>No menu items available right now</p>
                  </div>
                )}
              </>
            )
            : renderMenuSection(activeCategory, visibleCategories.find(c => c.id === activeCategory)?.name ?? '')
          }
        </div>

        {/* ── Reviews section ───────────────────────────────────────────── */}
        <section style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', margin: '0 0 4px' }}>Customer Reviews</h2>
              {avgRating !== null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: '#1a1a1a' }}>{avgRating.toFixed(1)}</span>
                  <div>
                    <StarDisplay rating={avgRating} size={16} />
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>{reviews.length} verified review{reviews.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              )}
            </div>
            {user && eligibleOrderId && !reviewSuccess && (
              <button onClick={() => setShowReviewForm(f => !f)}
                style={{ background: showReviewForm ? '#f3f4f6' : '#ff6b35', color: showReviewForm ? '#555' : '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                {showReviewForm ? 'Cancel' : '✏️ Write a Review'}
              </button>
            )}
          </div>

          {/* Review form */}
          {showReviewForm && user && eligibleOrderId && (
            <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', marginBottom: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.07)', border: '2px solid #fff7ed' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>Your Review</h3>
              {reviewError && <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>{reviewError}</div>}
              <div style={{ marginBottom: 14 }}>
                <p style={{ margin: '0 0 8px', fontSize: 13, color: '#555', fontWeight: 500 }}>Rating</p>
                <StarPicker value={reviewForm.rating} onChange={r => setReviewForm(f => ({ ...f, rating: r }))} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: '0 0 8px', fontSize: 13, color: '#555', fontWeight: 500 }}>Comment (optional)</p>
                <textarea
                  value={reviewForm.comment}
                  onChange={e => setReviewForm(f => ({ ...f, comment: e.target.value }))}
                  placeholder="Tell others what you liked about this restaurant…"
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
              <button onClick={submitReview} disabled={submittingReview}
                style={{ background: '#ff6b35', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 24px', cursor: submittingReview ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14, opacity: submittingReview ? 0.7 : 1 }}>
                {submittingReview ? 'Submitting…' : 'Submit Review'}
              </button>
            </div>
          )}

          {reviewSuccess && (
            <div style={{ background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: 12, padding: '14px 18px', marginBottom: 16, fontSize: 14, color: '#16a34a', fontWeight: 600 }}>
              ✅ Your review has been submitted and will appear once verified. Thank you!
            </div>
          )}

          {/* Review cards */}
          {reviews.length > 0 ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                {displayedReviews.map(review => (
                  <div key={review.id} style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #ff6b35, #f7931e)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
                          {((review.reviewer as any)?.full_name?.[0] ?? 'C').toUpperCase()}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: '#1a1a1a' }}>
                            {(review.reviewer as any)?.full_name || 'Verified Customer'}
                          </p>
                          <p style={{ margin: 0, fontSize: 11, color: '#aaa' }}>
                            {new Date(review.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <StarDisplay rating={review.rating} size={13} />
                    </div>
                    {review.comment && <p style={{ margin: 0, fontSize: 13, color: '#555', lineHeight: 1.55 }}>{review.comment}</p>}
                  </div>
                ))}
              </div>
              {reviews.length > 4 && (
                <button onClick={() => setShowAllReviews(s => !s)}
                  style={{ marginTop: 14, background: '#fff', border: '1px solid #e5e7eb', color: '#555', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14, width: '100%' }}>
                  {showAllReviews ? 'Show less' : `Show all ${reviews.length} reviews`}
                </button>
              )}
            </>
          ) : (
            <div style={{ background: '#fff', borderRadius: 16, padding: '40px 24px', textAlign: 'center', color: '#888', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⭐</div>
              <p style={{ margin: '0 0 6px', fontWeight: 600, color: '#555' }}>No reviews yet</p>
              <p style={{ margin: 0, fontSize: 13 }}>
                {user && eligibleOrderId ? 'Be the first to review this restaurant!' : 'Reviews from verified orders will appear here.'}
              </p>
              {user && eligibleOrderId && !showReviewForm && (
                <button onClick={() => setShowReviewForm(true)}
                  style={{ marginTop: 14, background: '#ff6b35', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
                  Write the First Review
                </button>
              )}
              {!user && (
                <button onClick={() => navigate('/auth')}
                  style={{ marginTop: 14, background: '#fff', border: '1px solid #ff6b35', color: '#ff6b35', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
                  Sign in to Review
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      {/* ── Floating cart bar ─────────────────────────────────────────────── */}
      {itemCount > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#ff6b35', color: '#fff', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 100, boxShadow: '0 -4px 16px rgba(0,0,0,0.15)' }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 16 }}>{itemCount} item{itemCount > 1 ? 's' : ''}</span>
            <span style={{ margin: '0 8px', opacity: 0.7 }}>·</span>
            <span style={{ fontWeight: 700, fontSize: 16 }}>₦{subtotal.toLocaleString()}</span>
          </div>
          <button onClick={() => navigate(`/restaurants/${id}/checkout`)}
            style={{ background: '#fff', color: '#ff6b35', border: 'none', borderRadius: 10, padding: '10px 24px', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
            View Cart →
          </button>
        </div>
      )}

      {/* ── Clear cart confirmation ───────────────────────────────────────── */}
      {showClearConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 380, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>Replace your cart?</h3>
            <p style={{ color: '#666', fontSize: 14, margin: '0 0 20px' }}>Your cart has items from another restaurant. Starting a new order will clear your current cart.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowClearConfirm(null)} style={{ flex: 1, padding: '10px 0', border: '1px solid #ddd', borderRadius: 10, background: '#fff', cursor: 'pointer', fontSize: 14 }}>Keep Cart</button>
              <button onClick={() => confirmClearAndAdd(showClearConfirm.item)} style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: 10, background: '#ff6b35', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>Start New Order</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{ position: 'fixed', bottom: itemCount > 0 ? 90 : 24, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 500, zIndex: 300, whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}
    </div>
  );
};

// ─── Menu Item Card ───────────────────────────────────────────────────────────
interface MenuItemCardProps {
  item: MenuItem;
  addons: Addon[];
  qty: number;
  onAdd: () => void;
}

const MenuItemCard = ({ item, addons, qty, onAdd }: MenuItemCardProps) => {
  const { updateQuantity } = useCart();
  const minAddonPrice = addons.length > 0 ? Math.min(...addons.map(a => a.price)) : null;

  return (
    <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', display: 'flex', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0', transition: 'box-shadow 0.15s' }}
      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'}
      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 6px rgba(0,0,0,0.06)'}
    >
      {item.image_url && (
        <div style={{ width: 110, minWidth: 110, height: 130, background: `url(${item.image_url}) center/cover no-repeat`, flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, padding: '14px 14px 14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1a1a1a', lineHeight: 1.3 }}>{item.name}</h4>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              {item.is_vegan && <span style={{ fontSize: 9, background: '#dcfce7', color: '#16a34a', padding: '2px 5px', borderRadius: 4, fontWeight: 700 }}>VEGAN</span>}
              {!item.is_vegan && item.is_vegetarian && <span style={{ fontSize: 9, background: '#dcfce7', color: '#15803d', padding: '2px 5px', borderRadius: 4, fontWeight: 700 }}>VEG</span>}
            </div>
          </div>
          {item.description && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, lineHeight: 1.4 }}>
              {item.description}
            </p>
          )}
          {addons.length > 0 && (
            <p style={{ margin: '5px 0 0', fontSize: 11, color: '#888' }}>
              🔧 Customizable · {addons.length} option{addons.length > 1 ? 's' : ''}
              {minAddonPrice !== null && minAddonPrice > 0 && ` from +₦${minAddonPrice.toLocaleString()}`}
            </p>
          )}
          {item.prep_time && (
            <p style={{ margin: '3px 0 0', fontSize: 11, color: '#bbb' }}>⏱ ~{item.prep_time} min</p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <span style={{ fontWeight: 700, color: '#ff6b35', fontSize: 16 }}>₦{Number(item.price).toLocaleString()}</span>
          {qty > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => updateQuantity(item.id, qty - 1)} style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #ff6b35', background: '#fff', color: '#ff6b35', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
              <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{qty}</span>
              <button onClick={onAdd} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#ff6b35', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
            </div>
          ) : (
            <button onClick={onAdd} style={{ background: '#ff6b35', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              Add +
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RestaurantDetail;
