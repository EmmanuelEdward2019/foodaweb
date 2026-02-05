import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type AuthMode = 'login' | 'register';

const AuthPage = () => {
    const navigate = useNavigate();
    const { user, role, loading: authLoading } = useAuth();

    const [mode, setMode] = useState<AuthMode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [businessName, setBusinessName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Redirect logged-in users to their dashboard
    useEffect(() => {
        if (!authLoading && user && role) {
            redirectToDashboard(role);
        }
    }, [user, role, authLoading]);

    const redirectToDashboard = (userRole: string) => {
        switch (userRole) {
            case 'admin':
                navigate('/admin', { replace: true });
                break;
            case 'vendor':
                navigate('/vendor', { replace: true });
                break;
            default:
                navigate('/', { replace: true });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            if (mode === 'login') {
                // Login flow
                console.log('Starting login...');
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                console.log('Login response:', { data, error });
                if (error) throw error;

                // After successful login, use user_metadata for immediate redirect
                // The AuthContext will handle proper role fetching in the background
                if (data.user) {
                    const userRole = data.user.user_metadata?.role || 'user';
                    console.log('Login successful, redirecting with role:', userRole);
                    setLoading(false); // Set loading to false before redirect
                    redirectToDashboard(userRole);
                }
            } else {
                // Registration flow - only for vendors
                if (password.length < 6) {
                    throw new Error('Password must be at least 6 characters long');
                }

                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            role: 'vendor',
                            business_name: businessName,
                            full_name: businessName
                        },
                        emailRedirectTo: `${window.location.origin}/auth`
                    }
                });

                if (error) throw error;

                // Check if user was created (not just confirmation email sent)
                if (data.user && !data.user.identities?.length) {
                    throw new Error('An account with this email already exists. Please login instead.');
                }

                if (data.user) {
                    // Create user in the users table for role management
                    const { error: userError } = await supabase
                        .from('users')
                        .insert({
                            id: data.user.id,
                            email: email,
                            role: 'vendor',
                            full_name: businessName,
                            is_active: true
                        });

                    if (userError) {
                        console.error('Error creating user record:', userError);
                    }

                    // Create vendor profile
                    const { error: vendorError } = await supabase
                        .from('vendors')
                        .insert({
                            owner_id: data.user.id,
                            name: businessName,
                            email: email,
                            is_active: true
                        });

                    if (vendorError) {
                        console.error('Error creating vendor profile:', vendorError);
                    }

                    // Check if email confirmation is required
                    if (data.session) {
                        // User is automatically signed in (no email confirmation required)
                        setSuccess('Account created successfully! Redirecting to your dashboard...');
                        setTimeout(() => {
                            redirectToDashboard('vendor');
                        }, 1500);
                    } else {
                        // Email confirmation required
                        setSuccess('Account created successfully! Please check your email to confirm your account, then login.');
                        setMode('login');
                        setEmail('');
                        setPassword('');
                        setBusinessName('');
                    }
                }
            }
        } catch (err: any) {
            console.error('Auth error:', err);
            setError(err.message || 'An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Show loading while checking auth state
    if (authLoading) {
        return (
            <div className="login-body">
                <div className="login-container">
                    <div className="login-header">
                        <h1>Loading...</h1>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="login-body">
            <div className="login-container">
                <div className="login-header">
                    <h1>{mode === 'login' ? 'Welcome Back' : 'Become a Vendor'}</h1>
                    <p>{mode === 'login' ? 'Login to your account' : 'Join Fooda as a restaurant partner'}</p>
                </div>

                <div className="login-form">
                    {error && (
                        <div style={{
                            color: '#dc2626',
                            backgroundColor: '#fee2e2',
                            padding: '12px',
                            borderRadius: '8px',
                            marginBottom: '15px',
                            fontSize: '14px'
                        }}>
                            {error}
                        </div>
                    )}

                    {success && (
                        <div style={{
                            color: '#16a34a',
                            backgroundColor: '#dcfce7',
                            padding: '12px',
                            borderRadius: '8px',
                            marginBottom: '15px',
                            fontSize: '14px'
                        }}>
                            {success}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        {mode === 'register' && (
                            <div className="form-group">
                                <label>Business/Restaurant Name</label>
                                <input
                                    type="text"
                                    value={businessName}
                                    onChange={(e) => setBusinessName(e.target.value)}
                                    required
                                    placeholder="Your Restaurant Name"
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label>Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="name@example.com"
                            />
                        </div>
                        <div className="form-group">
                            <label>Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                                minLength={6}
                            />
                        </div>

                        {mode === 'login' && (
                            <div className="form-options">
                                <label className="checkbox-label">
                                    <input type="checkbox" /> Remember me
                                </label>
                                <a href="#" className="forgot-password">Forgot Password?</a>
                            </div>
                        )}

                        <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
                            {loading ? 'Processing...' : (mode === 'login' ? 'Login' : 'Create Vendor Account')}
                        </button>
                    </form>

                    <div className="divider">
                        <span>OR</span>
                    </div>

                    <div className="signup-link">
                        {mode === 'login' ? (
                            <p>Want to become a vendor? <a href="#" onClick={(e) => { e.preventDefault(); setMode('register'); setError(null); setSuccess(null); }}>Register here</a></p>
                        ) : (
                            <p>Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); setMode('login'); setError(null); setSuccess(null); }}>Login</a></p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
