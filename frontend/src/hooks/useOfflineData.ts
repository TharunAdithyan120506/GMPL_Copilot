/**
 * useOfflineData — Generic stale-while-revalidate hook
 *
 * Pattern:
 *  1. Read from IndexedDB immediately → render with cached data (no loading spinner)
 *  2. Trigger background refresh from server → Dexie reactive update → re-render
 *
 * Usage:
 *  const { data, loading, isEmpty, refresh } = useOfflineData(
 *    () => VendorRepository.getAll(),
 *    () => VendorRepository.refresh(),
 *    db.vendors,
 *  );
 */
import { useCallback, useEffect, useState } from 'react';
import type { Table } from 'dexie';

interface UseOfflineDataResult<T> {
  data: T[];
  loading: boolean;     // true only on the FIRST load when IndexedDB is empty
  isEmpty: boolean;     // IndexedDB has data but it's an empty array
  refresh: () => void;  // manually trigger a forced server pull
  lastSyncedAt: number | null;
}

export function useOfflineData<T>(
  readFn: () => Promise<T[]>,
  refreshFn: (force?: boolean) => void,
  /** Dexie table — used to subscribe to live changes */
  table: Table<T, any>,
  lastSyncedAt: number | null = null,
): UseOfflineDataResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  // Load from IndexedDB immediately
  useEffect(() => {
    let cancelled = false;
    readFn().then(rows => {
      if (!cancelled) {
        setData(rows);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Subscribe to Dexie live updates (any write to this table re-reads)
  useEffect(() => {
    const subscription = table.hook('creating', () => {
      readFn().then(setData);
    });
    // Also hook updating and deleting
    const updateSub = table.hook('updating', () => {
      setTimeout(() => readFn().then(setData), 0);
    });
    const deleteSub = table.hook('deleting', () => {
      setTimeout(() => readFn().then(setData), 0);
    });
    return () => {
      table.hook('creating').unsubscribe(subscription as any);
      table.hook('updating').unsubscribe(updateSub as any);
      table.hook('deleting').unsubscribe(deleteSub as any);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trigger background refresh on mount (non-blocking)
  useEffect(() => {
    refreshFn(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(() => {
    refreshFn(true);
  }, [refreshFn]);

  return {
    data,
    loading,
    isEmpty: !loading && data.length === 0,
    refresh,
    lastSyncedAt,
  };
}
