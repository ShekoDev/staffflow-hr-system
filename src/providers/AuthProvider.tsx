import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import { loadSessionProfile, signOut as doSignOut, touchLastLogin } from '@/services/auth.service';
import type { RoleKey, SessionProfile } from '@/types/models';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'no-profile' | 'inactive';

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  profile: SessionProfile | null;
  roleKey: RoleKey | null;
  /** True when the signed-in user holds the permission (admins hold all). */
  can: (permission: string) => boolean;
  canAny: (permissions: string[]) => boolean;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  configured: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>(env.isConfigured ? 'loading' : 'unauthenticated');
  const loggedLoginFor = useRef<string | null>(null);

  const hydrate = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);

    if (!nextSession?.user) {
      setProfile(null);
      setStatus('unauthenticated');
      return;
    }

    const loaded = await loadSessionProfile(nextSession.user.id);

    if (!loaded) {
      setProfile(null);
      setStatus('no-profile');
      return;
    }
    if (!loaded.user.is_active) {
      setProfile(null);
      setStatus('inactive');
      await doSignOut();
      return;
    }

    setProfile(loaded);
    setStatus('authenticated');

    if (loggedLoginFor.current !== nextSession.user.id) {
      loggedLoginFor.current = nextSession.user.id;
      void touchLastLogin(nextSession.user.id);
    }
  }, []);

  useEffect(() => {
    if (!env.isConfigured) {
      setStatus('unauthenticated');
      return;
    }

    let cancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) void hydrate(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (cancelled) return;
      if (event === 'TOKEN_REFRESHED' && profileMatches(nextSession)) return;
      void hydrate(nextSession);
    });

    function profileMatches(next: Session | null): boolean {
      return Boolean(next?.user?.id && next.user.id === loggedLoginFor.current);
    }

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [hydrate]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await hydrate(data.session);
  }, [hydrate]);

  const signOut = useCallback(async () => {
    await doSignOut();
    loggedLoginFor.current = null;
    setProfile(null);
    setSession(null);
    setStatus('unauthenticated');
  }, []);

  const can = useCallback(
    (permission: string) => {
      if (!profile) return false;
      if (profile.roleKey === 'admin') return true;
      return profile.permissions.has(permission);
    },
    [profile],
  );

  const canAny = useCallback(
    (permissions: string[]) => permissions.some((permission) => can(permission)),
    [can],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      profile,
      roleKey: profile?.roleKey ?? null,
      can,
      canAny,
      isAdmin: profile?.roleKey === 'admin',
      refresh,
      signOut,
      configured: env.isConfigured,
    }),
    [status, session, profile, can, canAny, refresh, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
