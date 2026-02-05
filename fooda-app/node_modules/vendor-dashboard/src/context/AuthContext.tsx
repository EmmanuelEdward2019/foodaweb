import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, signIn, signOut, signUp, resetPassword } from '../services/supabaseClient';
import { User as DbUser, Vendor } from '../types/database';

interface AuthContextType {
    user: User | null;
    dbUser: DbUser | null;
    vendor: Vendor | null;
    session: Session | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<{ error: Error | null }>;
    logout: () => Promise<void>;
    register: (email: string, password: string, fullName: string, vendorName: string) => Promise<{ error: Error | null }>;
    forgotPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [dbUser, setDbUser] = useState<DbUser | null>(null);
    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchDbUser = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Error fetching user data:', error);
                return null;
            }
            return data as DbUser;
        } catch (err) {
            console.error('Error in fetchDbUser:', err);
            return null;
        }
    };

    const fetchVendor = async (ownerId: string) => {
        try {
            const { data, error } = await supabase
                .from('vendors')
                .select('*')
                .eq('owner_id', ownerId)
                .single();

            if (error) {
                console.error('Error fetching vendor data:', error);
                return null;
            }
            return data as Vendor;
        } catch (err) {
            console.error('Error in fetchVendor:', err);
            return null;
        }
    };

    useEffect(() => {
        const getInitialSession = async () => {
            try {
                const { data: { session: initialSession } } = await supabase.auth.getSession();
                setSession(initialSession);
                setUser(initialSession?.user ?? null);

                if (initialSession?.user) {
                    const userData = await fetchDbUser(initialSession.user.id);
                    setDbUser(userData);

                    if (userData) {
                        const vendorData = await fetchVendor(initialSession.user.id);
                        setVendor(vendorData);
                    }
                }
            } catch (error) {
                console.error('Error getting initial session:', error);
            } finally {
                setLoading(false);
            }
        };

        getInitialSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            setSession(currentSession);
            setUser(currentSession?.user ?? null);

            if (currentSession?.user) {
                const userData = await fetchDbUser(currentSession.user.id);
                setDbUser(userData);

                if (userData) {
                    const vendorData = await fetchVendor(currentSession.user.id);
                    setVendor(vendorData);
                }
            } else {
                setDbUser(null);
                setVendor(null);
            }
            setLoading(false);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const login = async (email: string, password: string) => {
        try {
            const { data, error } = await signIn(email, password);
            if (error) {
                return { error: new Error(error.message) };
            }

            // Verify user is a vendor
            if (data.user) {
                const userData = await fetchDbUser(data.user.id);
                if (userData && userData.role !== 'vendor') {
                    await signOut();
                    return { error: new Error('Access denied. Vendor account required.') };
                }
            }

            return { error: null };
        } catch (err: any) {
            return { error: new Error(err.message || 'Login failed') };
        }
    };

    const logout = async () => {
        await signOut();
        setUser(null);
        setDbUser(null);
        setVendor(null);
        setSession(null);
    };

    const register = async (email: string, password: string, fullName: string, vendorName: string) => {
        try {
            // Sign up the user
            const { data: authData, error: authError } = await signUp(email, password, {
                full_name: fullName,
                role: 'vendor'
            });

            if (authError) {
                return { error: new Error(authError.message) };
            }

            if (authData.user) {
                // Create user record
                const { error: userError } = await supabase
                    .from('users')
                    .insert({
                        id: authData.user.id,
                        email,
                        full_name: fullName,
                        role: 'vendor',
                        is_active: true
                    });

                if (userError) {
                    console.error('Error creating user record:', userError);
                }

                // Create vendor record
                const { error: vendorError } = await supabase
                    .from('vendors')
                    .insert({
                        owner_id: authData.user.id,
                        name: vendorName,
                        email,
                        is_active: true
                    });

                if (vendorError) {
                    console.error('Error creating vendor record:', vendorError);
                }
            }

            return { error: null };
        } catch (err: any) {
            return { error: new Error(err.message || 'Registration failed') };
        }
    };

    const forgotPassword = async (email: string) => {
        try {
            const { error } = await resetPassword(email);
            if (error) {
                return { error: new Error(error.message) };
            }
            return { error: null };
        } catch (err: any) {
            return { error: new Error(err.message || 'Password reset failed') };
        }
    };

    const value = {
        user,
        dbUser,
        vendor,
        session,
        loading,
        login,
        logout,
        register,
        forgotPassword
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
