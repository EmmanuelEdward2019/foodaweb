import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  order_id: string | null;
}

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  order_created:       { icon: '🛍️', color: '#3b82f6' },
  order_status_update: { icon: '📦', color: '#8b5cf6' },
  payment_received:    { icon: '💳', color: '#16a34a' },
  delivery_assigned:   { icon: '🛵', color: '#f59e0b' },
  custom:              { icon: '📢', color: '#ff6b35' },
  system:              { icon: 'ℹ️', color: '#6b7280' },
};

const timeAgo = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

const Notifications = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('notifications')
      .select('id, type, title, message, is_read, created_at, order_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(60)
      .then(({ data }) => {
        setNotifications(data ?? []);
        setLoading(false);
      });
  }, [user]);

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user!.id)
      .eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleClick = async (n: Notification) => {
    if (!n.is_read) await markRead(n.id);
    if (n.order_id) navigate(`/orders/${n.order_id}`);
  };

  const unread = notifications.filter(n => !n.is_read);
  const read   = notifications.filter(n => n.is_read);

  if (!user) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif', gap: 12 }}>
      <p>Please sign in to view notifications.</p>
      <Link to="/auth" style={{ color: '#ff6b35', fontWeight: 600 }}>Sign In</Link>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <header style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/restaurants')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#555', padding: 0 }}>←</button>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>Notifications</span>
          {unread.length > 0 && (
            <span style={{ background: '#dc2626', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
              {unread.length} new
            </span>
          )}
        </div>
        {unread.length > 0 && (
          <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff6b35', fontWeight: 600, fontSize: 14 }}>
            Mark all read
          </button>
        )}
      </header>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#888' }}>Loading…</div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🔔</div>
            <h3 style={{ margin: '0 0 8px', color: '#444' }}>All quiet here</h3>
            <p style={{ margin: '0 0 24px', color: '#888', fontSize: 14 }}>Order updates, payment confirmations, and alerts will appear here.</p>
            <Link to="/restaurants" style={{ background: '#ff6b35', color: '#fff', textDecoration: 'none', padding: '11px 24px', borderRadius: 10, fontWeight: 700, fontSize: 14 }}>
              Browse Restaurants
            </Link>
          </div>
        ) : (
          <>
            {/* Unread section */}
            {unread.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 10px' }}>
                  New · {unread.length}
                </h3>
                {unread.map(n => <NotifCard key={n.id} notif={n} onClick={() => handleClick(n)} />)}
              </div>
            )}

            {/* Read section */}
            {read.length > 0 && (
              <div>
                {unread.length > 0 && (
                  <h3 style={{ fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 10px' }}>
                    Earlier
                  </h3>
                )}
                {read.map(n => <NotifCard key={n.id} notif={n} onClick={() => handleClick(n)} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const NotifCard = ({ notif, onClick }: { notif: Notification; onClick: () => void }) => {
  const cfg = TYPE_CONFIG[notif.type] ?? { icon: '🔔', color: '#6b7280' };
  return (
    <div
      onClick={onClick}
      style={{
        background: notif.is_read ? '#fff' : '#fff7ed',
        border: notif.is_read ? '1px solid #f0f0f0' : '1px solid #fed7aa',
        borderRadius: 14,
        padding: '14px 16px',
        marginBottom: 10,
        cursor: notif.order_id ? 'pointer' : 'default',
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={e => { if (notif.order_id) (e.currentTarget as HTMLDivElement).style.opacity = '0.85'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
    >
      {/* Icon circle */}
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        background: `${cfg.color}15`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0,
      }}>
        {cfg.icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 3 }}>
          <p style={{ margin: 0, fontWeight: notif.is_read ? 600 : 700, fontSize: 14, color: '#1a1a1a' }}>
            {notif.title}
          </p>
          <span style={{ fontSize: 11, color: '#bbb', flexShrink: 0, marginTop: 1 }}>{timeAgo(notif.created_at)}</span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#666', lineHeight: 1.45 }}>{notif.message}</p>
        {notif.order_id && (
          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ff6b35', fontWeight: 600 }}>View order →</p>
        )}
      </div>

      {!notif.is_read && (
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff6b35', flexShrink: 0, marginTop: 5 }} />
      )}
    </div>
  );
};

export default Notifications;
