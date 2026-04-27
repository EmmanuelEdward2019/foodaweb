import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

type UserRole = 'admin' | 'vendor' | 'customer' | 'user' | null;

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
            if (loading) setLoading(false);
        }, 3000);

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchUserRole(session.user);
            } else {
                setLoading(false);
            }
        }).catch(() => {
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
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
        // DB role is always authoritative — never trust metadata for role decisions
        // (admins can have their role changed in the DB without re-registering)
        const fallback = (authUser.user_metadata?.role as UserRole) || 'customer';
        try {
            const { data, error } = await Promise.race([
                supabase.from('users').select('role').eq('id', authUser.id).single(),
                new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
            ]);
            setRole((!error && data?.role) ? data.role as UserRole : fallback);
        } catch {
            setRole(fallback);
        } finally {
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
