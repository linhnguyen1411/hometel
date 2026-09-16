import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/index.js';
import { api } from '../services/api.js';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  activeCompanyId: string | null;
  setActiveCompanyId: (id: string | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; fullName: string; phone?: string }) => Promise<void>;
  logout: () => void;
  switchDemoRole: (roleName: 'SUPER_ADMIN' | 'OWNER' | 'PROVIDER' | 'STAFF' | 'TENANT' | 'GUEST') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const DEMO_USERS = {
  SUPER_ADMIN: { email: 'admin@propertyv1.com', password: 'Admin@123', label: 'Super Admin', sub: 'Global Platform Control' },
  OWNER: { email: 'owner1@greenliving.com', password: 'Owner@123', label: 'Property Owner', sub: 'Green Living Real Estate' },
  PROVIDER: { email: 'cleanmaster@clean.com', password: 'Provider@123', label: 'Service Provider', sub: 'CleanMaster Pro Services' },
  STAFF: { email: 'staff1@greenliving.com', password: 'Staff@123', label: 'Property Staff', sub: 'Nguyen Bao Chau' },
  TENANT: { email: 'tenant1@gmail.com', password: 'Tenant@123', label: 'Active Tenant', sub: 'Nguyen Thanh Son (Rm 101)' },
  GUEST: { email: '', password: '', label: 'Public Guest', sub: 'Browse & Apply' },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('property_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('property_token');
      if (storedToken) {
        try {
          const userData = await api.getMe();
          setUser(userData);
          if (userData.memberships && userData.memberships.length > 0) {
            setActiveCompanyId(userData.memberships[0].companyId);
          }
        } catch (err) {
          console.warn('Session expired or invalid token', err);
          localStorage.removeItem('property_token');
          localStorage.removeItem('property_refresh');
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.login({ email, password });
      localStorage.setItem('property_token', res.accessToken);
      localStorage.setItem('property_refresh', res.refreshToken);
      setToken(res.accessToken);
      setUser(res.user);
      if (res.user.memberships && res.user.memberships.length > 0) {
        setActiveCompanyId(res.user.memberships[0].companyId);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: { email: string; password: string; fullName: string; phone?: string }) => {
    setIsLoading(true);
    try {
      const res = await api.register(data);
      localStorage.setItem('property_token', res.accessToken);
      localStorage.setItem('property_refresh', res.refreshToken);
      setToken(res.accessToken);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    const refresh = localStorage.getItem('property_refresh');
    if (refresh) {
      fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh })
      }).catch(() => {});
    }
    localStorage.removeItem('property_token');
    localStorage.removeItem('property_refresh');
    setToken(null);
    setUser(null);
    setActiveCompanyId(null);
  };

  const switchDemoRole = async (roleName: 'SUPER_ADMIN' | 'OWNER' | 'PROVIDER' | 'STAFF' | 'TENANT' | 'GUEST') => {
    if (roleName === 'GUEST') {
      logout();
      return;
    }

    const demo = DEMO_USERS[roleName];
    if (demo) {
      await login(demo.email, demo.password);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        activeCompanyId,
        setActiveCompanyId,
        login,
        register,
        logout,
        switchDemoRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
