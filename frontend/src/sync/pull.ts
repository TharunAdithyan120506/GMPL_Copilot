/**
 * sync/pull.ts — Inbound sync (server → IndexedDB)
 *
 * Conflict strategy per table:
 *  - vendors, moulds, materials  → server-wins
 *  - logs                        → append-only (never overwrite submitted)
 *  - editRequests                → state-machine (pull only, no local merge)
 *  - dashboard / widgets         → server-wins, widget-level (§13)
 *  - notifications               → server-only, 15s TTL
 *  - analyticsCache              → server-wins, 5min TTL
 */
import { db, type SyncMeta } from '../lib/db';
import api from '../utils/api';
import { connectivity } from '../lib/connectivity';

// ─── Cache policies per table ─────────────────────────────────────────────────

type CachePolicy = Pick<SyncMeta, 'ttlMs' | 'conflictStrategy'>;

const CACHE_POLICIES: Record<string, CachePolicy> = {
  vendors:        { ttlMs: 10 * 60_000,  conflictStrategy: 'server-wins' },
  moulds:         { ttlMs: 10 * 60_000,  conflictStrategy: 'server-wins' },
  materials:      { ttlMs: 10 * 60_000,  conflictStrategy: 'server-wins' },
  logs:           { ttlMs:  5 * 60_000,  conflictStrategy: 'append-only' },
  editRequests:   { ttlMs:  5 * 60_000,  conflictStrategy: 'state-machine' },
  dashboard:      { ttlMs: 30_000,        conflictStrategy: 'server-wins' },
  notifications:  { ttlMs: 15_000,        conflictStrategy: 'server-wins' },
  analyticsCache: { ttlMs:  5 * 60_000,  conflictStrategy: 'server-wins' },
  settings:       { ttlMs: 60 * 60_000,  conflictStrategy: 'server-wins' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function isFresh(table: string): Promise<boolean> {
  const meta = await db.syncMeta.get(table);
  if (!meta) return false;
  
  // If the table is completely empty, it is never fresh (handles logout/clear edge cases)
  const dbTable = (db as any)[table];
  if (dbTable && typeof dbTable.count === 'function') {
    const count = await dbTable.count();
    if (count === 0) return false;
  }

  const ttl = CACHE_POLICIES[table]?.ttlMs ?? 5 * 60_000;
  return Date.now() - meta.lastSyncedAt < ttl;
}

async function markSynced(table: string, error: string | null = null): Promise<void> {
  const policy = CACHE_POLICIES[table];
  const now = Date.now();
  const ttl = policy?.ttlMs ?? 5 * 60_000;
  await db.syncMeta.put({
    table,
    lastSyncedAt: error ? (await db.syncMeta.get(table))?.lastSyncedAt ?? now : now,
    lastPull: now,
    lastPush: (await db.syncMeta.get(table))?.lastPush ?? null,
    lastError: error,
    cacheExpiry: error ? null : now + ttl,
    ttlMs: ttl,
    conflictStrategy: policy?.conflictStrategy ?? 'server-wins',
  });
}

/** Exported — used by SyncContext to display "last synced" time. */
export async function getLastSyncedAt(table: string): Promise<number | null> {
  const meta = await db.syncMeta.get(table);
  return meta?.lastSyncedAt ?? null;
}

// ─── Pull functions ───────────────────────────────────────────────────────────

export async function pullVendors(force = false): Promise<void> {
  if (!connectivity.isOnline) return;
  if (!force && await isFresh('vendors')) return;
  try {
    const res = await api.get('/vendors');
    const items = res.data?.data ?? [];
    const now = Date.now();
    await db.transaction('rw', db.vendors, db.syncMeta, async () => {
      await db.vendors.clear();
      await db.vendors.bulkPut(items.map((v: any) => ({
        ...v,
        _syncedAt: now,
        _version: v.version ?? 1,
        _syncStatus: 'synced' as const,
      })));
      await markSynced('vendors');
    });
  } catch (err: any) {
    await markSynced('vendors', err?.message ?? 'Network error');
  }
}

export async function pullMoulds(force = false): Promise<void> {
  if (!connectivity.isOnline) return;
  if (!force && await isFresh('moulds')) return;
  try {
    const res = await api.get('/moulds');
    const items = res.data?.data ?? [];
    const now = Date.now();
    await db.transaction('rw', db.moulds, db.syncMeta, async () => {
      await db.moulds.clear();
      await db.moulds.bulkPut(items.map((m: any) => ({
        ...m,
        _syncedAt: now,
        _version: m.version ?? 1,
        _syncStatus: 'synced' as const,
      })));
      await markSynced('moulds');
    });
  } catch (err: any) {
    await markSynced('moulds', err?.message ?? 'Network error');
  }
}

export async function pullMaterials(force = false): Promise<void> {
  if (!connectivity.isOnline) return;
  if (!force && await isFresh('materials')) return;
  try {
    const res = await api.get('/raw-materials');
    const items = res.data?.data ?? [];
    const now = Date.now();
    await db.transaction('rw', db.materials, db.syncMeta, async () => {
      await db.materials.clear();
      await db.materials.bulkPut(items.map((m: any) => ({
        ...m,
        _syncedAt: now,
        _syncStatus: 'synced' as const,
      })));
      await markSynced('materials');
    });
  } catch (err: any) {
    await markSynced('materials', err?.message ?? 'Network error');
  }
}

export async function pullLogs(force = false): Promise<void> {
  if (!connectivity.isOnline) return;
  if (!force && await isFresh('logs')) return;
  try {
    // Only cache last 30 days (§22 Large Dataset Strategy)
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const res = await api.get('/logs', { params: { 'filter[log_date][gte]': since } });
    const items = res.data?.data ?? [];
    const now = Date.now();
    await db.transaction('rw', db.logs, db.syncMeta, async () => {
      // Append-only: clear then re-insert from server (server is source of truth for submitted logs)
      // Optimistic local drafts will be overwritten — that's correct, server version wins on submit
      const all = await db.logs.toArray();
      const optimistic = all.filter(l => l._isOptimistic);
      await db.logs.clear();
      const serverItems = items.map((l: any) => ({
        ...l,
        logDate: typeof l.logDate === 'string' ? l.logDate.split('T')[0] : (l.logDate instanceof Date ? l.logDate.toISOString().split('T')[0] : String(l.logDate || '').split('T')[0]),
        _syncedAt: now,
        _isOptimistic: false,
        _syncStatus: 'synced' as const,
      }));
      await db.logs.bulkPut(serverItems);
      const serverKeys = new Set(serverItems.map((l: any) => `${l.assignmentId}_${l.logDate}`));
      const remainingOptimistic = optimistic.filter(o => !serverKeys.has(`${o.assignmentId}_${o.logDate}`));
      if (remainingOptimistic.length > 0) {
        await db.logs.bulkPut(remainingOptimistic);
      }
      await markSynced('logs');
    });
  } catch (err: any) {
    await markSynced('logs', err?.message ?? 'Network error');
  }
}

export async function pullEditRequests(force = false): Promise<void> {
  if (!connectivity.isOnline) return;
  if (!force && await isFresh('editRequests')) return;
  try {
    const res = await api.get('/edit-requests');
    const items = res.data?.data ?? [];
    const now = Date.now();
    await db.transaction('rw', db.editRequests, db.syncMeta, async () => {
      const all = await db.editRequests.toArray();
      const optimistic = all.filter(r => r._isOptimistic);
      await db.editRequests.clear();
      await db.editRequests.bulkPut(items.map((r: any) => ({
        ...r,
        _syncedAt: now,
        _isOptimistic: false,
        _syncStatus: 'synced' as const,
      })));
      if (optimistic.length > 0) {
        await db.editRequests.bulkPut(optimistic);
      }
      await markSynced('editRequests');
    });
  } catch (err: any) {
    await markSynced('editRequests', err?.message ?? 'Network error');
  }
}

export async function pullDashboard(force = false): Promise<void> {
  if (!connectivity.isOnline) return;
  if (!force && await isFresh('dashboard')) return;
  try {
    const res = await api.get('/analytics/dashboard');
    const data = res.data?.data ?? null;
    await db.transaction('rw', db.dashboard, db.syncMeta, async () => {
      await db.dashboard.put({ id: 'singleton', data, _syncedAt: Date.now() });
      await markSynced('dashboard');
    });
  } catch (err: any) {
    await markSynced('dashboard', err?.message ?? 'Network error');
  }
}

/**
 * §13 — Widget-level dashboard caching.
 * Each KPI widget refreshes independently — no full-dashboard re-fetch needed.
 */
export async function pullDashboardWidget(
  widgetId: 'production' | 'inventory' | 'mould-life' | 'vendor' | 'notifications' | 'approvals',
  force = false,
): Promise<void> {
  if (!connectivity.isOnline) return;
  const metaKey = `dashboard-${widgetId}`;
  if (!force && await isFresh(metaKey)) return;
  try {
    const res = await api.get(`/analytics/dashboard/${widgetId}`);
    const data = res.data?.data ?? null;
    const now = Date.now();
    await db.transaction('rw', db.dashboardWidgets, db.syncMeta, async () => {
      await db.dashboardWidgets.put({ widgetId, data, _syncedAt: now });
      await markSynced(metaKey);
    });
  } catch (err: any) {
    await markSynced(`dashboard-${widgetId}`, err?.message ?? 'Network error');
  }
}

/** §5 — Notifications — server-only, never mutated locally (15s TTL). */
export async function pullNotifications(force = false): Promise<void> {
  if (!connectivity.isOnline) return;
  if (!force && await isFresh('notifications')) return;
  try {
    const res = await api.get('/notifications');
    const items = res.data?.data ?? [];
    const now = Date.now();
    await db.transaction('rw', db.notifications, db.syncMeta, async () => {
      await db.notifications.clear();
      await db.notifications.bulkPut(items.map((n: any) => ({
        ...n,
        _syncedAt: now,
        _syncStatus: 'synced' as const,
      })));
      await markSynced('notifications');
    });
  } catch (err: any) {
    await markSynced('notifications', err?.message ?? 'Network error');
  }
}

/** §5 — Analytics cache — server-wins, 5min TTL. */
export async function pullAnalytics(
  reportType: 'production' | 'raw-material' | 'mould-life' | 'downtime',
  force = false,
): Promise<void> {
  if (!connectivity.isOnline) return;
  const metaKey = `analytics-${reportType}`;
  if (!force && await isFresh(metaKey)) return;
  try {
    const res = await api.get(`/analytics/${reportType}`);
    const data = res.data?.data ?? null;
    const now = Date.now();
    const ttl = CACHE_POLICIES.analyticsCache.ttlMs;
    await db.transaction('rw', db.analyticsCache, db.syncMeta, async () => {
      await db.analyticsCache.put({ reportType, data, expiresAt: now + ttl, _syncedAt: now });
      await markSynced(metaKey);
    });
  } catch (err: any) {
    await markSynced(`analytics-${reportType}`, err?.message ?? 'Network error');
  }
}

/** Pull all core tables. Used on boot, focus, and reconnect. */
export async function pullAll(force = false): Promise<void> {
  await Promise.allSettled([
    pullVendors(force),
    pullMoulds(force),
    pullMaterials(force),
    pullLogs(force),
    pullEditRequests(force),
    pullDashboard(force),
    pullNotifications(force),
  ]);
}
