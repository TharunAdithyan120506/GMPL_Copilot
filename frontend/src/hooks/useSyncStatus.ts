/**
 * useSyncStatus — Reactive 3-state sync indicator
 *
 * Returns:
 *  'synced'  🟢 — no pending jobs, online
 *  'pending' 🟡 — offline or jobs in queue
 *  'error'   🔴 — one or more jobs failed/conflict
 */
import { useEffect, useState } from 'react';
import { syncQueue } from '../lib/sync-queue';
import { connectivity } from '../lib/connectivity';

export type SyncStatus = 'synced' | 'pending' | 'error';

interface SyncStatusResult {
  status: SyncStatus;
  pendingCount: number;
  failedCount: number;
  isOnline: boolean;
}

export function useSyncStatus(): SyncStatusResult {
  const [isOnline, setIsOnline] = useState(connectivity.isOnline);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  useEffect(() => {
    const unsub = connectivity.subscribe(setIsOnline);
    return unsub;
  }, []);

  useEffect(() => {
    async function update() {
      const [p, f] = await Promise.all([
        syncQueue.pendingCount(),
        syncQueue.failedCount(),
      ]);
      setPendingCount(p);
      setFailedCount(f);
    }

    update();
    const unsub = syncQueue.subscribe(update);
    return unsub;
  }, []);

  let status: SyncStatus = 'synced';
  if (failedCount > 0) status = 'error';
  else if (!isOnline || pendingCount > 0) status = 'pending';

  return { status, pendingCount, failedCount, isOnline };
}
