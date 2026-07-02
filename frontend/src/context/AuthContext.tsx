import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getMe } from '../api/auth';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('merchantToken'));
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const u = await getMe();
      setUser(u);

      // Load and store API key
      const client = (await import('../api/client')).default;
      try {
        const settings = await client.get('/auth/user-settings').then((r) => r.data);
        if (settings.api_key) {
          localStorage.setItem('merchantApiKey', settings.api_key);
        }
      } catch {
        // API key loading failed, but user is logged in
      }
    } catch {
      localStorage.removeItem('merchantToken');
      localStorage.removeItem('merchantApiKey');
      setToken(null);
      setUser(null);
    }
  };

  useEffect(() => {
    if (token) {
      fetchUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (newToken: string) => {
    localStorage.setItem('merchantToken', newToken);
    setToken(newToken);
    const u = await getMe();
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem('merchantToken');
    localStorage.removeItem('merchantApiKey');
    setToken(null);
    setUser(null);
  };

  const refreshUser = fetchUser;

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be within AuthProvider');
  return ctx;
}
