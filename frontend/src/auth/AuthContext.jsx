import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getMe, login as loginRequest, logout as logoutRequest } from '../api/client.js';

const AuthContext = createContext(null);

/**
 * Holds the signed-in admin. The session itself lives in an HttpOnly cookie;
 * this only mirrors the public admin profile for rendering.
 */
export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', admin: null });
  const epoch = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const startedAt = epoch.current;
    let active = true;

    getMe({ signal: controller.signal })
      .then(({ data }) => {
        if (active && epoch.current === startedAt) {
          setState({ status: 'authenticated', admin: data });
        }
      })
      .catch((error) => {
        if (!active || error.name === 'AbortError') return;
        // Ignore a late failure if a sign-in already happened in the meantime.
        if (epoch.current === startedAt) setState({ status: 'anonymous', admin: null });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  // A 401 from any request means the session expired or was revoked.
  useEffect(() => {
    const handleUnauthorized = () => {
      epoch.current += 1;
      setState({ status: 'anonymous', admin: null });
    };
    window.addEventListener('dispatch:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('dispatch:unauthorized', handleUnauthorized);
  }, []);

  const login = useCallback(async (credentials) => {
    const { data } = await loginRequest(credentials);
    epoch.current += 1;
    setState({ status: 'authenticated', admin: data });
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      epoch.current += 1;
      setState({ status: 'anonymous', admin: null });
    }
  }, []);

  const value = useMemo(
    () => ({ ...state, login, logout }),
    [state, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
