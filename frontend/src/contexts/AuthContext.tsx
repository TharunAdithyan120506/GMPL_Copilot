import { useEffect, useState } from 'react';
import { AuthContext } from './auth-context';

type UserRole = 'company' | 'vendor';

export interface User {
  id: string;
  role: UserRole;
  vendorId?: string;
  permissions: string[];
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('gmpl_token'));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('gmpl_user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('gmpl_token', newToken);
    localStorage.setItem('gmpl_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('gmpl_token');
    localStorage.removeItem('gmpl_user');
    setToken(null);
    setUser(null);
  };

  useEffect(() => {
    window.addEventListener('gmpl:unauthorized', logout);
    return () => window.removeEventListener('gmpl:unauthorized', logout);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}
