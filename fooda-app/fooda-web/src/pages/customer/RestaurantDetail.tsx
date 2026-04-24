import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useCart } from '../../context/CartContext';
import { CustomerNav } from './RestaurantList';

interface Vendor {
  id: string;
  name: string;
  description?: string;
  logo_url?: string;
  cover_image_url?: string;
  address?: { street?: string; area?: string; city?: string };
  phone?: string;
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

const RestaurantDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem, items: cartItems, vendorId: cartVendorId, itemCount, subtotal, clearCart } = useCart();

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState<{ item: MenuItem } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from('vendors').select('*').eq('id', id).single(),
      supabase.from('menu_categories').select('id, name, description, sort_order').eq('vendor_id', id).eq('is_active', true).order('sort_order'),
      supabase.from('menu_items').select('id, category_id, name, description, price, image_url, is_available, is_vegetarian, is_vegan, prep_time').eq('vendor_id', id).eq('is_available', true).order('sort_order'),
    ]).then(([{ data: v }, { data: cats }, { data: items }]) => {
      setVendor(v);
      setCategories(cats ?? []);
      setMenuItems(items ?? []);
      setLoading(false);
    });
  }, [id]);

  const handleAddItem = (item: MenuItem) => {
    if (cartVendorId && cartVendorId !== id) {
      setShowClearConfirm({ item });
      return;
    }
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

  const itemsByCategory: Record<string, MenuItem[]> = { all: menuItems };
  categories.forEach(cat => {
    itemsByCategory[cat.id] = menuItems.filter(i => i.category_id === cat.id);
  });
  const uncategorised = menuItems.filter(i => !i.category_id);
  if (uncategorised.length) itemsByCategory['uncategorised'] = uncategorised;

  const visibleCategories = [
    { id: 'all', name: 'All Items' },
    ...categories.filter(c => (itemsByCategory[c.id] ?? []).length > 0),
    ...(uncategorised.length ? [{ id: 'uncategorised', name: 'Other' }] : []),
  ];

  const scrollToCategory = (catId: string) => {
    setActiveCategory(catId);
    if (catId === 'all') { window.scrollTo({ top: 280, behavior: 'smooth' }); return; }
    categoryRefs.current[catId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <CustomerNav />
      <div style={{ textAlign: 'center', padding: '80px 0', color: '#888' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🍽️</div>
        <p>Loading menu…</p>
      </div>
    </div>
  );

  if (!vendor) return (
    <div style={{ minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <CustomerNav />
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <h2>Restaurant not found</h2>
        <button onClick={() => navigate('/restaurants')} style={{ background: '#ff6b35', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', marginTop: 12 }}>
          Back to Restaurants
        </button>
      </div>
    </div>
  );

  const renderMenuSection = (catId: string, catName: string) => {
    const items = itemsByCategory[catId] ?? [];
    if (!items.length) return null;
    return (
      <div key={catId} ref={el => { categoryRefs.current[catId] = el; }} style={{ marginBottom: 36 }}>
        {catId !== 'all' && <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', margin: '0 0 16px', paddingTop: 8 }}>{catName}</h2>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {items.map(item => (
            <MenuItemCard key={item.id} item={item} qty={cartQty(item.id)} onAdd={() => handleAddItem(item)} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', fontFamily: 'Inter, system-ui, sans-serif', paddingBottom: itemCount > 0 ? 96 : 0 }}>
      <CustomerNav />

      {/* Cover */}
      <div style={{
        height: 220,
        background: vendor.cover_image_url ? `url(${vendor.cover_image_url}) center/cover` : 'linear-gradient(135deg, #ff6b35, #f7931e)',
        position: 'relative',
      }}>
        <button onClick={() => navigate('/restaurants')} style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(0,0,0,0.4)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 14 }}>
          ← Back
        </button>
        {vendor.logo_url && (
          <img src={vendor.logo_url} alt={vendor.name} style={{ position: 'absolute', bottom: -28, left: 24, width: 72, height: 72, borderRadius: '50%', border: '3px solid #fff', objectFit: 'cover', background: '#fff' }} />
        )}
      </div>

      {/* Info */}
      <div style={{ background: '#fff', padding: `${vendor.logo_url ? 44 : 20}px 24px 20px`, borderBottom: '1px solid #f0f0f0' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 800, color: '#1a1a1a' }}>{vendor.name}</h1>
        {vendor.description && <p style={{ margin: '0 0 8px', color: '#666', fontSize: 14 }}>{vendor.description}</p>}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {vendor.address?.area && <span style={{ fontSize: 13, color: '#888' }}>📍 {[vendor.address.area, vendor.address.city].filter(Boolean).join(', ')}</span>}
          {vendor.phone && <span style={{ fontSize: 13, color: '#888' }}>📞 {vendor.phone}</span>}
        </div>
      </div>

      {/* Category tabs */}
      {visibleCategories.length > 1 && (
        <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', overflowX: 'auto', position: 'sticky', top: 57, zIndex: 40 }}>
          <div style={{ display: 'flex', gap: 0, padding: '0 24px', whiteSpace: 'nowrap' }}>
            {visibleCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => scrollToCategory(cat.id)}
                style={{
                  padding: '14px 18px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: activeCategory === cat.id ? 700 : 500,
                  color: activeCategory === cat.id ? '#ff6b35' : '#555',
                  borderBottom: activeCategory === cat.id ? '2px solid #ff6b35' : '2px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Menu items */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px' }}>
        {activeCategory === 'all'
          ? (
            <>
              {categories.filter(c => (itemsByCategory[c.id] ?? []).length > 0).map(c => renderMenuSection(c.id, c.name))}
              {uncategorised.length > 0 && renderMenuSection('uncategorised', 'Other')}
              {menuItems.length === 0 && (
                <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🍽️</div>
                  <p>No menu items available</p>
                </div>
              )}
            </>
          )
          : renderMenuSection(activeCategory, visibleCategories.find(c => c.id === activeCategory)?.name ?? '')
        }
      </div>

      {/* Floating cart bar */}
      {itemCount > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#ff6b35', color: '#fff', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 100, boxShadow: '0 -4px 16px rgba(0,0,0,0.15)' }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 16 }}>{itemCount} item{itemCount > 1 ? 's' : ''}</span>
            <span style={{ margin: '0 8px', opacity: 0.7 }}>·</span>
            <span style={{ fontWeight: 700, fontSize: 16 }}>₦{subtotal.toLocaleString()}</span>
          </div>
          <button
            onClick={() => navigate(`/restaurants/${id}/checkout`)}
            style={{ background: '#fff', color: '#ff6b35', border: 'none', borderRadius: 10, padding: '10px 24px', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}
          >
            View Cart →
          </button>
        </div>
      )}

      {/* Clear cart confirmation */}
      {showClearConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 380, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>Replace your cart?</h3>
            <p style={{ color: '#666', fontSize: 14, margin: '0 0 20px' }}>
              Your cart has items from another restaurant. Starting a new order will clear your current cart.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowClearConfirm(null)} style={{ flex: 1, padding: '10px 0', border: '1px solid #ddd', borderRadius: 10, background: '#fff', cursor: 'pointer', fontSize: 14 }}>
                Keep Cart
              </button>
              <button onClick={() => confirmClearAndAdd(showClearConfirm.item)} style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: 10, background: '#ff6b35', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
                Start New Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: itemCount > 0 ? 90 : 24, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 500, zIndex: 300, whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}
    </div>
  );
};

interface MenuItemCardProps {
  item: MenuItem;
  qty: number;
  onAdd: () => void;
}

const MenuItemCard = ({ item, qty, onAdd }: MenuItemCardProps) => {
  const { updateQuantity } = useCart();
  return (
    <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', display: 'flex', gap: 0, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0' }}>
      {item.image_url && (
        <div style={{ width: 100, minWidth: 100, height: 110, background: `url(${item.image_url}) center/cover` }} />
      )}
      <div style={{ flex: 1, padding: '14px 14px 14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1a1a1a' }}>{item.name}</h4>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              {item.is_vegan && <span title="Vegan" style={{ fontSize: 10, background: '#dcfce7', color: '#16a34a', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>VEGAN</span>}
              {!item.is_vegan && item.is_vegetarian && <span title="Vegetarian" style={{ fontSize: 10, background: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>VEG</span>}
            </div>
          </div>
          {item.description && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{item.description}</p>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <span style={{ fontWeight: 700, color: '#ff6b35', fontSize: 16 }}>₦{item.price.toLocaleString()}</span>
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
