import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type AuthMode = 'login' | 'register_customer' | 'register_vendor';

const AuthPage = () => {
    const navigate = useNavigate();
    const { user, role, loading: authLoading } = useAuth();

    const [mode, setMode] = useState<AuthMode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [businessName, setBusinessName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && user && role) {
            redirectToDashboard(role);
        }
    }, [user, role, authLoading]);

    const redirectToDashboard = (userRole: string) => {
        switch (userRole) {
            case 'admin': navigate('/admin', { replace: true }); break;
            case 'vendor': navigate('/vendor', { replace: true }); break;
            default: navigate('/restaurants', { replace: true });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            if (mode === 'login') {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                if (data.user) {
                    const userRole = data.user.user_metadata?.role || 'customer';
                    setLoading(false);
                    redirectToDashboard(userRole);
                }
            } else if (mode === 'register_customer') {
                if (password.length < 6) throw new Error('Password must be at least 6 characters');
                const { data, error } = await supabase.auth.signUp({
                    email, password,
                    options: {
                        data: { role: 'customer', full_name: fullName },
                        emailRedirectTo: `${window.location.origin}/auth`,
                    },
                });
                if (error) throw error;
                if (data.user && !data.user.identities?.length)
                    throw new Error('An account with this email already exists. Please login instead.');

                if (data.user) {
                    await supabase.from('users').insert({
                        id: data.user.id,
                        email,
                        role: 'customer',
                        full_name: fullName,
                        is_active: true,
                    });

                    if (data.session) {
                        setSuccess('Account created! Redirecting…');
                        setTimeout(() => redirectToDashboard('customer'), 1200);
                    } else {
                        setSuccess('Account created! Please check your email to verify, then log in.');
                        setMode('login');
                        setEmail(''); setPassword(''); setFullName('');
                    }
                }
            } else {
                // register_vendor
                if (password.length < 6) throw new Error('Password must be at least 6 characters');
                const { data, error } = await supabase.auth.signUp({
                    email, password,
                    options: {
                        data: { role: 'vendor', business_name: businessName, full_name: businessName },
                        emailRedirectTo: `${window.location.origin}/auth`,
                    },
                });
                if (error) throw error;
                if (data.user && !data.user.identities?.length)
                    throw new Error('An account with this email already exists. Please login instead.');

                if (data.user) {
                    await supabase.from('users').insert({
                        id: data.user.id,
                        email,
                        role: 'vendor',
                        full_name: businessName,
                        is_active: true,
                    });
                    await supabase.from('vendors').insert({
                        owner_id: data.user.id,
                        name: businessName,
                        email,
                        is_active: true,
                    });

                    if (data.session) {
                        setSuccess('Vendor account created! Redirecting…');
                        setTimeout(() => redirectToDashboard('vendor'), 1200);
                    } else {
                        setSuccess('Vendor account created! Check your email to confirm, then log in.');
                        setMode('login');
                        setEmail(''); setPassword(''); setBusinessName('');
                    }
                }
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (authLoading) return (
        <div style={styles.page}>
            <div style={styles.card}>
                <h2 style={{ margin: 0, color: '#ff6b35' }}>Loading…</h2>
            </div>
        </div>
    );

    const tabLabels: { mode: AuthMode; label: string }[] = [
        { mode: 'login', label: 'Sign In' },
        { mode: 'register_customer', label: 'Customer Sign Up' },
        { mode: 'register_vendor', label: 'Vendor Sign Up' },
    ];

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, color: '#ff6b35' }}>Fooda</h1>
                    <p style={{ margin: '4px 0 0', color: '#888', fontSize: 14 }}>
                        {mode === 'login' ? 'Welcome back!' : mode === 'register_customer' ? 'Create your account' : 'Join as a restaurant'}
                    </p>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderRadius: 10, background: '#f5f5f5', padding: 4, marginBottom: 24, gap: 2 }}>
                    {tabLabels.map(({ mode: m, label }) => (
                        <button
                            key={m}
                            onClick={() => { setMode(m); setError(null); setSuccess(null); }}
                            style={{
                                flex: 1,
                                padding: '9px 4px',
                                border: 'none',
                                borderRadius: 8,
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: mode === m ? 700 : 500,
                                background: mode === m ? '#fff' : 'transparent',
                                color: mode === m ? '#ff6b35' : '#888',
                                boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                                transition: 'all 0.15s',
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {error && <div style={styles.errorBox}>{error}</div>}
                {success && <div style={styles.successBox}>{success}</div>}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {mode === 'register_customer' && (
                        <div>
                            <label style={styles.label}>Full Name</label>
                            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="Your full name" style={styles.input} />
                        </div>
                    )}

                    {mode === 'register_vendor' && (
                        <div>
                            <label style={styles.label}>Restaurant Name</label>
                            <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} required placeholder="Your restaurant name" style={styles.input} />
                        </div>
                    )}

                    <div>
                        <label style={styles.label}>Email Address</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="name@example.com" style={styles.input} />
                    </div>

                    <div>
                        <label style={styles.label}>Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" minLength={6} style={styles.input} />
                    </div>

                    <button type="submit" disabled={loading} style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}>
                        {loading ? 'Processing…' : mode === 'login' ? 'Sign In' : mode === 'register_customer' ? 'Create Account' : 'Register Restaurant'}
                    </button>
                </form>

                {mode === 'login' && (
                    <p style={{ textAlign: 'center', fontSize: 13, color: '#aaa', marginTop: 16 }}>
                        New here? Use the tabs above to create an account.
                    </p>
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
    label: {
        display: 'block' as const,
        fontSize: 13,
        fontWeight: 600,
        color: '#444',
        marginBottom: 6,
    },
    input: {
        width: '100%',
        padding: '11px 14px',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        fontSize: 15,
        outline: 'none',
        boxSizing: 'border-box' as const,
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
    errorBox: {
        color: '#dc2626',
        background: '#fee2e2',
        padding: '11px 14px',
        borderRadius: 10,
        marginBottom: 4,
        fontSize: 14,
    },
    successBox: {
        color: '#16a34a',
        background: '#dcfce7',
        padding: '11px 14px',
        borderRadius: 10,
        marginBottom: 4,
        fontSize: 14,
    },
};

export default AuthPage;
