import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

type UserRole = 'admin' | 'vendor' | 'user' | null;

interface AuthContextType {
    user: User | null;
    session: Session | null;
    role: UserRole;
    loading: boolean;
    signOut: () => Promise<void>;
    refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    role: null,
    loading: true,
    signOut: async () => { },
    refreshRole: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [role, setRole] = useState<UserRole>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Add timeout to prevent infinite loading
        const timeout = setTimeout(() => {
            if (loading) {
                console.warn('Auth loading timeout reached, forcing load complete');
                setLoading(false);
            }
        }, 3000); // 3 second timeout (reduced from 10s)

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchUserRole(session.user);
            } else {
                setLoading(false);
            }
        }).catch((error) => {
            console.error('Error getting session:', error);
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth state change:', event);
            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                await fetchUserRole(session.user);
            } else {
                setRole(null);
                setLoading(false);
            }
        });

        return () => {
            clearTimeout(timeout);
            subscription.unsubscribe();
        };
    }, []);

    const fetchUserRole = async (authUser: User) => {
        try {
            // First, set role from metadata immediately to avoid blocking
            const metaRole = authUser.user_metadata?.role;
            if (metaRole) {
                setRole(metaRole as UserRole);
                setLoading(false);
            }

            // Then try to fetch from users table with timeout (non-blocking)
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Database query timeout')), 5000)
            );

            const queryPromise = supabase
                .from('users')
                .select('role')
                .eq('id', authUser.id)
                .single();

            try {
                const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

                if (!error && data?.role) {
                    // Update role if we got a different one from the database
                    if (data.role !== metaRole) {
                        console.log('Updating role from database:', data.role);
                        setRole(data.role as UserRole);
                    }
                } else if (error) {
                    console.log('User not found in users table or query blocked:', error.message);
                }
            } catch (timeoutError) {
                console.log('Database query timed out, using metadata role');
            }

            // If we didn't set role from metadata, use default
            if (!metaRole) {
                setRole('user');
                setLoading(false);
            }
        } catch (error) {
            console.error('Error fetching role:', error);
            // Ultimate fallback
            setRole(authUser.user_metadata?.role || 'user');
            setLoading(false);
        }
    };

    const refreshRole = async () => {
        if (user) {
            await fetchUserRole(user);
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setRole(null);
        setUser(null);
        setSession(null);
    };

    return (
        <AuthContext.Provider value={{ user, session, role, loading, signOut, refreshRole }}>
            {children}
        </AuthContext.Provider>
    );
};
