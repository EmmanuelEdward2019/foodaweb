import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const UpdatePassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [done, setDone] = useState(false);

  // Supabase fires a PASSWORD_RECOVERY event when the user lands here from the
  // reset email. We wait for that before allowing the form, so a random visitor
  // can't update someone else's password.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryReady(true);
    });

    // Also handle the case where the recovery already happened before this
    // page mounted (e.g. user already had an active session).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setRecoveryReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      // Sign out so the recovery session doesn't grant access; user re-logs in
      // with the new password explicitly.
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate('/auth', { replace: true });
      }, 2000);
    } catch (err: any) {
      setError(err.message ?? 'Could not update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, color: '#ff6b35' }}>Fooda</h1>
          <p style={{ margin: '4px 0 0', color: '#888', fontSize: 14 }}>Set a new password</p>
        </div>

        {done ? (
          <div style={styles.successBox}>
            Password updated! Redirecting to sign in…
          </div>
        ) : !recoveryReady ? (
          <div>
            <p style={{ textAlign: 'center', color: '#666', fontSize: 14, lineHeight: 1.6 }}>
              This page only works when opened from the password reset email.
            </p>
            <Link
              to="/auth/reset"
              style={{ display: 'block', textAlign: 'center', marginTop: 16, color: '#ff6b35', fontWeight: 600, textDecoration: 'none' }}
            >
              Request a new reset link
            </Link>
          </div>
        ) : (
          <>
            {error && <div style={styles.errorBox}>{error}</div>}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={styles.label}>New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  style={styles.input}
                  autoFocus
                />
              </div>
              <div>
                <label style={styles.label}>Confirm new password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  style={styles.input}
                />
              </div>
              <button type="submit" disabled={loading} style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 50%, #1a1a2e 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  card: {
    background: '#fff',
    borderRadius: 20,
    padding: '36px 32px',
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 6 },
  input: {
    width: '100%',
    padding: '11px 14px',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    fontSize: 15,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  button: {
    padding: '13px 0',
    background: '#ff6b35',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 16,
    cursor: 'pointer',
    marginTop: 4,
    fontFamily: 'inherit',
  },
  errorBox: { color: '#dc2626', background: '#fee2e2', padding: '11px 14px', borderRadius: 10, marginBottom: 12, fontSize: 14 },
  successBox: { color: '#16a34a', background: '#dcfce7', padding: '13px 16px', borderRadius: 10, fontSize: 14, lineHeight: 1.5, textAlign: 'center' },
};

export default UpdatePassword;
