'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User, Session } from '@supabase/supabase-js';

interface SupabaseProviderProps {
  children: ReactNode;
}

// Internal state for user authentication
interface UserAuthState {
  user: User | null;
  session: Session | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// Combined state for the context
export interface SupabaseContextState extends UserAuthState {
  areServicesAvailable: boolean;
}

// Return type for useUser() - specific to user auth state
export interface UserHookResult {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// React Context
export const SupabaseContext = createContext<SupabaseContextState | undefined>(undefined);

/**
 * SupabaseProvider manages and provides Supabase user authentication state.
 * Renamed from SupabaseProvider but keeps the same structure so components don't break.
 */
export const SupabaseProvider: React.FC<SupabaseProviderProps> = ({ children }) => {
  const supabase = createClient();
  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: null,
    session: null,
    isUserLoading: true,
    userError: null,
  });

  useEffect(() => {
    let mounted = true;

    async function getInitialSession() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (mounted) {
          if (error) throw error;
          setUserAuthState({
            user: session?.user ?? null,
            session: session,
            isUserLoading: false,
            userError: null,
          });
        }
      } catch (error: any) {
        if (mounted) {
          setUserAuthState({ user: null, session: null, isUserLoading: false, userError: error });
        }
      }
    }

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (mounted) {
          setUserAuthState({
            user: session?.user ?? null,
            session: session,
            isUserLoading: false,
            userError: null,
          });
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Service worker registration is handled in src/components/ServiceWorkerRegistration.tsx
  // to avoid duplication and keep this provider focused on authentication.
  useEffect(() => {
    // Registration removed from here
  }, []);

  const contextValue = useMemo((): SupabaseContextState => {
    return {
      areServicesAvailable: true,
      user: userAuthState.user,
      session: userAuthState.session,
      isUserLoading: userAuthState.isUserLoading,
      userError: userAuthState.userError,
    };
  }, [userAuthState]);

  return (
    <SupabaseContext.Provider value={contextValue}>
      {children}
    </SupabaseContext.Provider>
  );
};

/**
 * Hook to access user authentication state.
 */
export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider.');
  }
  return context;
};

// Return dummy objects for things that are no longer needed
export const useAuth = () => supabaseAuthDummy();
export const useFirestore = () => null;
export const useSupabaseApp = () => null;
export const useStorage = () => null;
export const useAppCheck = () => null;

function supabaseAuthDummy() {
  return {
    signOut: async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
  }
}

type MemoSupabase<T> = T & { __memo?: boolean };

export function useMemoSupabase<T>(factory: () => T, deps: DependencyList): T | (MemoSupabase<T>) {
  const memoized = useMemo(factory, deps);

  if (typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoSupabase<T>).__memo = true;

  return memoized;
}

/**
 * Hook specifically for accessing the authenticated user's state.
 */
export const useUser = (): UserHookResult => {
  const { user, isUserLoading, userError } = useSupabase();
  return { user, isUserLoading, userError };
};

