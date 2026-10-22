'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { api, ApiError, endsSession, SESSION_ENDED_EVENT } from '@/lib/api';
import {
  clearToken,
  readToken,
  saveToken,
  subscribeToToken,
} from '@/lib/session-store';
import type {
  Profile,
  RegisterInput,
  RegisterResponse,
  TokenResponse,
} from '@/lib/types';

type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; token: string; profile: Profile };

interface SessionContextValue {
  state: SessionState;
  /** Why the user was signed out, shown once on the sign-in screen. */
  notice: string | null;
  signIn(email: string, password: string): Promise<void>;
  register(input: RegisterInput): Promise<void>;
  signOut(notice?: string): void;
  /** Re-reads the profile and balance, e.g. after money moves. */
  refresh(): Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

async function fetchProfile(token: string): Promise<Profile> {
  return (await api<Profile>('/users/me', { token })).data;
}

/** No token is known while prerendering; `undefined` means "not read yet". */
const serverToken = () => undefined;

export function SessionProvider({ children }: { children: ReactNode }) {
  const token = useSyncExternalStore(subscribeToToken, readToken, serverToken);
  const [loaded, setLoaded] = useState<{ token: string; profile: Profile } | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);

  const signOut = useCallback((reason?: string) => {
    setNotice(reason ?? null);
    setLoaded(null);
    clearToken();
  }, []);

  // Load the profile for a token restored from this tab.
  useEffect(() => {
    if (!token || loaded?.token === token) return;
    let cancelled = false;
    fetchProfile(token)
      .then((profile) => !cancelled && setLoaded({ token, profile }))
      .catch((error: unknown) => {
        // A 401/blocked response already signed out with its own message.
        if (cancelled || (error instanceof ApiError && endsSession(error))) return;
        signOut("Couldn't load your account. Sign in again.");
      });
    return () => {
      cancelled = true;
    };
  }, [token, loaded, signOut]);

  // The API ended the session (token expired, account blocked).
  useEffect(() => {
    const onEnded = (event: Event) => {
      const reason = (event as CustomEvent<string>).detail;
      signOut(
        reason === 'Account is blocked'
          ? 'Your account has been blocked. Contact support if you think this is a mistake.'
          : 'Your session expired. Sign in again.',
      );
    };
    window.addEventListener(SESSION_ENDED_EVENT, onEnded);
    return () => window.removeEventListener(SESSION_ENDED_EVENT, onEnded);
  }, [signOut]);

  const startSession = useCallback(async (newToken: string, profile?: Profile) => {
    setNotice(null);
    setLoaded({ token: newToken, profile: profile ?? (await fetchProfile(newToken)) });
    saveToken(newToken);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data } = await api<TokenResponse>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      await startSession(data.accessToken);
    },
    [startSession],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const { data } = await api<RegisterResponse>('/auth/register', {
        method: 'POST',
        body: input,
      });
      await startSession(data.auth.accessToken, {
        user: data.user,
        wallet: data.wallet,
      });
    },
    [startSession],
  );

  const refresh = useCallback(async () => {
    if (!token) return;
    const profile = await fetchProfile(token);
    setLoaded({ token, profile });
  }, [token]);

  const state: SessionState = useMemo(() => {
    if (token === undefined) return { status: 'loading' };
    if (token === null) return { status: 'signed-out' };
    if (loaded?.token === token) {
      return { status: 'signed-in', token, profile: loaded.profile };
    }
    return { status: 'loading' };
  }, [token, loaded]);

  const value = useMemo(
    () => ({ state, notice, signIn, register, signOut, refresh }),
    [state, notice, signIn, register, signOut, refresh],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside SessionProvider');
  return context;
}

/** The signed-in session; only valid inside <RequireAuth>. */
export function useSignedIn() {
  const { state, ...actions } = useSession();
  if (state.status !== 'signed-in') {
    throw new Error('useSignedIn must be used inside RequireAuth');
  }
  return { token: state.token, profile: state.profile, ...actions };
}
