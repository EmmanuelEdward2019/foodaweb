import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
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
    // Track the id of the user we last loaded so token refreshes (which arrive
    // as a NEW session object but the same user) don't cascade `user` reference
    // changes downstream — that's what was unmounting open forms on tab focus.
    const lastUserIdRef = useRef<string | null>(null);

    useEffect(() => {
        // Add timeout to prevent infinite loading
        const timeout = setTimeout(() => {
            setLoading(prev => prev ? false : prev);
        }, 3000);

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            const u = session?.user ?? null;
            setUser(u);
            lastUserIdRef.current = u?.id ?? null;
            if (u) {
                fetchUserRole(u);
            } else {
                setLoading(false);
            }
        }).catch(() => {
            setLoading(false);
        });

        // Listen for auth changes. We deliberately filter out TOKEN_REFRESHED
        // events where only the access token has rotated — propagating a new
        // `user` reference for the same id would cause every dashboard with
        // `useEffect(..., [user])` to refetch and remount, wiping form state.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
            const nextUser = nextSession?.user ?? null;
            const nextId = nextUser?.id ?? null;
            const prevId = lastUserIdRef.current;

            // Session always updates (token may have changed and other places need it)
            setSession(nextSession);

            if (event === 'TOKEN_REFRESHED' && nextId && nextId === prevId) {
                // Same user, just a refreshed token. Don't touch user state or refetch role.
                return;
            }

            // Identity actually changed (sign-in, sign-out, or different user)
            setUser(nextUser);
            lastUserIdRef.current = nextId;

            if (nextUser) {
                await fetchUserRole(nextUser);
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
        // DB role is the only source of truth. We never trust user_metadata.role,
        // because a signed-in user can mutate metadata via supabase.auth.updateUser
        // and would otherwise escalate themselves to admin. On DB failure we fall
        // back to the lowest privilege role ('customer') rather than what the
        // client claims to be.
        try {
            const { data, error } = await Promise.race([
                supabase.from('users').select('role').eq('id', authUser.id).single(),
                new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
            ]);
            setRole((!error && data?.role) ? data.role as UserRole : 'customer');
        } catch {
            setRole('customer');
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
        lastUserIdRef.current = null;
    };

    return (
        <AuthContext.Provider value={{ user, session, role, loading, signOut, refreshRole }}>
            {children}
        </AuthContext.Provider>
    );
};
