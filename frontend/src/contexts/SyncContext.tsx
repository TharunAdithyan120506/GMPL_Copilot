/**
 * SyncContext — Global sync state provider
 *
 * Provides:
 *   status       🟢 'synced' | 🟡 'pending' | 🔴 'error'
 *   pendingCount  number of mutations waiting to be uploaded
 *   failedCount   number of permanently failed / conflict jobs
 *   isOnline      current network state
 *   lastSyncedAt  epoch ms of most recent successful pull
 *   forceSync()   manually trigger a full refresh
 *
 * Wire into the component tree at the App level (outside <Routes>).
 * Children consume via the `useSyncContext()` hook (or `useSyncStatus()` for simple cases).
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { syncQueue } from '../lib/sync-queue';
import { connectivity } from '../lib/connectivity';
import { syncScheduler } from '../sync/scheduler';
import { getLastSyncedAt } from '../sync/pull';
import type { SyncStatus } from '../hooks/useSyncStatus';

// ─── Context shape ────────────────────────────────────────────────────────────

interface SyncContextValue {
  status: SyncStatus;
  pendingCount: number;
  failedCount: number;
  isOnline: boolean;
  lastSyncedAt: number | null;
  forceSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(connectivity.isOnline);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  // Subscribe to connectivity changes
  useEffect(() => {
    return connectivity.subscribe(setIsOnline);
  }, []);

  // Subscribe to queue changes (reactive — updates whenever a job is added/completed/failed)
  useEffect(() => {
    async function update() {
      const [p, f, syncedAt] = await Promise.all([
        syncQueue.pendingCount(),
        syncQueue.failedCount(),
        getLastSyncedAt('vendors'), // use vendors as a proxy for "last full sync"
      ]);
      setPendingCount(p);
      setFailedCount(f);
      setLastSyncedAt(syncedAt);
    }

    update(); // initial read
    return syncQueue.subscribe(update); // re-run on every queue mutation
  }, []);

  // Start the background scheduler once, when the provider mounts
  useEffect(() => {
    syncScheduler.start();
    // Note: scheduler.stop() is intentionally NOT called on unmount
    // because the provider is app-root and lives for the entire session.
  }, []);

  const forceSync = useCallback(async () => {
    await syncScheduler.forceSync();
    // Re-read lastSyncedAt after the forced sync
    const syncedAt = await getLastSyncedAt('vendors');
    setLastSyncedAt(syncedAt);
  }, []);

  // Derive status from counts + connectivity
  let status: SyncStatus = 'synced';
  if (failedCount > 0) status = 'error';
  else if (!isOnline || pendingCount > 0) status = 'pending';

  return (
    <SyncContext.Provider value={{ status, pendingCount, failedCount, isOnline, lastSyncedAt, forceSync }}>
      {children}
    </SyncContext.Provider>
  );
}

// ─── Consumer hook ────────────────────────────────────────────────────────────

/**
 * Full sync context — use when you need forceSync() or lastSyncedAt.
 * For simple status-only use, prefer `useSyncStatus()`.
 */
export function useSyncContext(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error('useSyncContext must be used inside <SyncProvider>');
  }
  return ctx;
}
