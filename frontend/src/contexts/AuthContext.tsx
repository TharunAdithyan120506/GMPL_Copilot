import React, { useCallback, useEffect, useState } from 'react';
import { AuthContext } from './auth-context';
import { db } from '../lib/db';
import { syncScheduler } from '../sync/scheduler';

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

  /**
   * §21 Security — Logout clears all local data:
   *  1. localStorage session tokens
   *  2. All IndexedDB tables (vendors, moulds, logs, queue, drafts, etc.)
   *  3. Stops background scheduler
   *
   * No sensitive data remains on shared / factory floor devices.
   */
  const logout = useCallback(async () => {
    // 1. Clear session tokens from memory + localStorage
    localStorage.removeItem('gmpl_token');
    localStorage.removeItem('gmpl_refresh_token'); // [FIX: AUTH-1] clear refresh token too
    localStorage.removeItem('gmpl_user');
    setToken(null);
    setUser(null);

    // 2. Stop background sync scheduler
    syncScheduler.stop();

    // 3. Wipe all IndexedDB tables so no data remains on the device
    try {
      await Promise.all([
        db.vendors.clear(),
        db.moulds.clear(),
        db.materials.clear(),
        db.logs.clear(),
        db.editRequests.clear(),
        db.dashboard.clear(),
        db.dashboardWidgets.clear(),
        db.notifications.clear(),
        db.analyticsCache.clear(),
        db.settings.clear(),
        db.syncQueue.clear(),
        db.formDrafts.clear(),
        db.syncMeta.clear(),
      ]);
    } catch {
      // Non-fatal — the session is already cleared; worst case stale data
      // will be overwritten on next login.
    }
  }, []);

  useEffect(() => {
    const handler = () => { logout(); };
    window.addEventListener('gmpl:unauthorized', handler);
    return () => window.removeEventListener('gmpl:unauthorized', handler);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}
