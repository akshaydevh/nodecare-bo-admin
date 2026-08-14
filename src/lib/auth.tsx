import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  apiRequest,
  clearStoredTokens,
  getStoredUser,
  setStoredTokens,
  setStoredUser,
  type AdminUser,
} from './api';

type AuthContextValue = {
  user: AdminUser | null;
  login: (login: string, password: string) => Promise<AdminUser>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AdminUser>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<AdminUser | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(() => getStoredUser());

  const login = useCallback(async (loginId: string, password: string) => {
    const data = await apiRequest<{
      accessToken: string;
      refreshToken: string;
      user: AdminUser;
    }>(
      '/admin/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ login: loginId, password }),
      },
      false,
    );
    setStoredTokens(data.accessToken, data.refreshToken);
    setStoredUser(data.user);
    setUser(data.user);
    return data.user;
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const data = await apiRequest<{ user: AdminUser; message: string }>(
      '/admin/auth/change-password',
      {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      },
    );
    setStoredUser(data.user);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('bo_refresh_token');
    try {
      if (refreshToken) {
        await apiRequest('/admin/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch {
      // ignore logout errors
    }
    clearStoredTokens();
    setUser(null);
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const me = await apiRequest<AdminUser>('/admin/auth/me');
      setStoredUser(me);
      setUser(me);
      return me;
    } catch {
      clearStoredTokens();
      setUser(null);
      return null;
    }
  }, []);

  const value = useMemo(
    () => ({ user, login, changePassword, logout, refreshMe }),
    [user, login, changePassword, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
