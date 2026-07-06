/**
 * useLiveQuery — Cache-first, live-updating data hook
 *
 * This is the core hook for ALL offline-first pages.
 *
 * Contract:
 *   1. Read from IndexedDB IMMEDIATELY on mount → data available in <1ms
 *   2. Trigger background refresh (non-blocking) → server pull updates IndexedDB
 *   3. Subscribe to Dexie table changes → React re-renders automatically
 *   4. NEVER set data to null/[] between refreshes (§ Phase 5 — Stop clearing state)
 *   5. `isEmpty` is true only if IndexedDB is empty AND we've finished loading
 *   6. `isFirstLoad` is true only if IndexedDB has never been synced (first install)
 *
 * Usage:
 *   const { data, isEmpty, isFirstLoad, lastSyncedAt } = useLiveQuery(
 *     () => MouldRepository.getAll(),
 *     () => MouldRepository.refresh(),
 *     db.moulds,
 *   );
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Table } from 'dexie';
import { getLastSyncedAt } from '../sync/pull';

export interface LiveQueryResult<T> {
  data: T[];
  /** True ONLY on the very first visit when IndexedDB has never been synced */
  isFirstLoad: boolean;
  /** True when the cache is empty AND we've already done the initial read */
  isEmpty: boolean;
  /** Epoch ms of last successful server pull, null if never synced */
  lastSyncedAt: number | null;
  /** Manually trigger a forced server pull */
  refresh: () => void;
}

export function useLiveQuery<T extends { id: string | number }>(
  /** Reads from IndexedDB — called on mount and on every table change */
  readFn: () => Promise<T[]>,
  /** Triggers a background server pull — never awaited by the hook */
  refreshFn: (force?: boolean) => void,
  /** The Dexie table to subscribe to — changes trigger automatic re-render */
  table: Table<T, any>,
  /** The SyncMeta key to read lastSyncedAt from (usually same as table name) */
  syncMetaKey?: string,
): LiveQueryResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [initialReadDone, setInitialReadDone] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const mountedRef = useRef(true);

  // ── Initial read from IndexedDB (synchronous from the user's perspective) ──
  useEffect(() => {
    mountedRef.current = true;
    readFn().then(rows => {
      if (!mountedRef.current) return;
      // §Phase 5: never set to [] — keep previous data if rows is empty until sync confirms
      setData(rows);
      setInitialReadDone(true);
    });
    return () => { mountedRef.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Subscribe to SyncMeta for lastSyncedAt ──
  useEffect(() => {
    if (!syncMetaKey) return;
    getLastSyncedAt(syncMetaKey).then(ts => {
      if (mountedRef.current) setLastSyncedAt(ts);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncMetaKey]);

  // ── Subscribe to Dexie table changes — fires on every write (pull or mutation) ──
  useEffect(() => {
    const reRead = () => {
      readFn().then(rows => {
        if (!mountedRef.current) return;
        setData(rows);
        // Also refresh lastSyncedAt when table updates
        if (syncMetaKey) {
          getLastSyncedAt(syncMetaKey).then(ts => {
            if (mountedRef.current) setLastSyncedAt(ts);
          });
        }
      });
    };

    // [FIX: SYNC-2] Use the correct Dexie v4 subscribe/unsubscribe pattern.
    // Calling hook('creating', fn) returns a subscriber handle — store and unsubscribe that handle.
    // The previous pattern of calling .unsubscribe(returnValue) was incorrect.
    const creatingHook = table.hook('creating');
    const updatingHook = table.hook('updating');
    const deletingHook = table.hook('deleting');

    const onDelayed = () => setTimeout(reRead, 0);

    creatingHook.subscribe(reRead);
    updatingHook.subscribe(onDelayed);
    deletingHook.subscribe(onDelayed);

    return () => {
      creatingHook.unsubscribe(reRead);
      updatingHook.unsubscribe(onDelayed);
      deletingHook.unsubscribe(onDelayed);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Background refresh on mount — non-blocking ──
  useEffect(() => {
    refreshFn(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(() => refreshFn(true), [refreshFn]);

  return {
    data,
    isFirstLoad: !initialReadDone,
    isEmpty: initialReadDone && data.length === 0,
    lastSyncedAt,
    refresh,
  };
}
