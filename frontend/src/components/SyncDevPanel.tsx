/**
 * SyncDevPanel — §23 Development Tools
 *
 * Displays real-time visibility into the sync engine:
 *   - Queue jobs (pending, in-flight, failed, conflict, done)
 *   - Retry counts per job
 *   - Cache size per table
 *   - Last sync timestamps per table
 *   - Connectivity status
 *   - Sync duration (approximate)
 *
 * Rendered ONLY in development (import.meta.env.DEV).
 * Triggered by pressing Ctrl+Shift+S anywhere in the app.
 */
import { useEffect, useState, useCallback } from 'react';
import { db } from '../lib/db';
import { syncQueue } from '../lib/sync-queue';
import { syncScheduler } from '../sync/scheduler';
import { connectivity } from '../lib/connectivity';
import type { SyncJob } from '../lib/db';

interface TableSize {
  name: string;
  count: number;
  lastSyncedAt: number | null;
  lastError: string | null;
  cacheExpiry: number | null;
}

function formatMs(ms: number | null): string {
  if (!ms) return '—';
  const diff = Date.now() - ms;
  if (diff < 5000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

function StatusChip({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending:   'bg-yellow-200 text-yellow-900',
    'in-flight': 'bg-blue-200 text-blue-900',
    done:      'bg-green-200 text-green-900',
    failed:    'bg-red-200 text-red-900',
    conflict:  'bg-orange-200 text-orange-900',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${colors[status] ?? 'bg-gray-200 text-gray-700'}`}>
      {status}
    </span>
  );
}

export function SyncDevPanel() {
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [tableSizes, setTableSizes] = useState<TableSize[]>([]);
  const [isOnline, setIsOnline] = useState(connectivity.isOnline);
  const [syncing, setSyncing] = useState(false);

  // Keyboard shortcut: Ctrl+Shift+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        setOpen(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Connectivity
  useEffect(() => {
    return connectivity.subscribe(setIsOnline);
  }, []);

  const refresh = useCallback(async () => {
    const [allJobs, metas] = await Promise.all([
      syncQueue.allJobs(),
      db.syncMeta.toArray(),
    ]);
    setJobs(allJobs);

    const tables = [
      { name: 'vendors',       table: db.vendors },
      { name: 'moulds',        table: db.moulds },
      { name: 'materials',     table: db.materials },
      { name: 'logs',          table: db.logs },
      { name: 'editRequests',  table: db.editRequests },
      { name: 'notifications', table: db.notifications },
      { name: 'analyticsCache',table: db.analyticsCache },
      { name: 'settings',      table: db.settings },
      { name: 'syncQueue',     table: db.syncQueue },
      { name: 'formDrafts',    table: db.formDrafts },
    ] as const;

    const sizes = await Promise.all(
      tables.map(async ({ name, table }) => {
        const count = await (table as any).count();
        const meta = metas.find(m => m.table === name);
        return {
          name,
          count,
          lastSyncedAt: meta?.lastSyncedAt ?? null,
          lastError: meta?.lastError ?? null,
          cacheExpiry: meta?.cacheExpiry ?? null,
        };
      })
    );
    setTableSizes(sizes);
  }, []);

  // Auto-refresh when open
  useEffect(() => {
    if (!open) return;
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [open, refresh]);

  // Subscribe to queue changes
  useEffect(() => {
    return syncQueue.subscribe(() => {
      if (open) refresh();
    });
  }, [open, refresh]);

  const handleForceSync = async () => {
    setSyncing(true);
    await syncScheduler.forceSync();
    setSyncing(false);
    refresh();
  };

  const handleClearDone = async () => {
    const done = jobs.filter(j => j.status === 'done' && j.id != null);
    await Promise.all(done.map(j => db.syncQueue.delete(j.id!)));
    refresh();
  };

  if (!import.meta.env.DEV) return null;

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        title="Sync Dev Panel (Ctrl+Shift+S)"
        className="fixed bottom-4 right-4 z-[999] w-10 h-10 rounded-full bg-black text-white border-2 border-white shadow-lg flex items-center justify-center text-xs font-mono font-bold hover:bg-gray-800 transition-colors"
      >
        ⚡
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-16 right-4 z-[998] w-[520px] max-h-[80vh] overflow-auto bg-gray-950 text-gray-100 border-2 border-gray-700 shadow-2xl rounded-none font-mono text-xs flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-gray-900 border-b border-gray-700 sticky top-0">
            <span className="font-bold text-green-400">⚡ GMPL Sync Dev Panel</span>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className="text-gray-400">{isOnline ? 'online' : 'offline'}</span>
              <button
                onClick={handleForceSync}
                disabled={syncing || !isOnline}
                className="px-2 py-0.5 bg-blue-700 text-white rounded text-[10px] hover:bg-blue-600 disabled:opacity-50"
              >
                {syncing ? 'syncing…' : 'Force Sync'}
              </button>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white ml-1">✕</button>
            </div>
          </div>

          {/* Cache Sizes */}
          <div className="px-3 py-2 border-b border-gray-800">
            <p className="text-gray-400 uppercase text-[10px] mb-1.5 font-bold tracking-wide">Cache Sizes</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              {tableSizes.map(t => (
                <div key={t.name} className="flex justify-between items-center">
                  <span className={`text-gray-300 ${t.lastError ? 'text-red-400' : ''}`}>{t.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-yellow-400">{t.count}</span>
                    <span className="text-gray-500">{t.lastSyncedAt ? formatMs(t.lastSyncedAt) : '—'}</span>
                    {t.lastError && <span title={t.lastError} className="text-red-400">⚠</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Queue Jobs */}
          <div className="px-3 py-2 flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-gray-400 uppercase text-[10px] font-bold tracking-wide">
                Queue ({jobs.length} jobs)
              </p>
              {jobs.some(j => j.status === 'done') && (
                <button
                  onClick={handleClearDone}
                  className="text-[10px] text-gray-500 hover:text-gray-300 underline"
                >
                  Clear done
                </button>
              )}
            </div>

            {jobs.length === 0 && (
              <p className="text-gray-500 text-center py-4">Queue is empty 🎉</p>
            )}

            <div className="flex flex-col gap-1">
              {jobs.map(job => (
                <div
                  key={job.id}
                  className="bg-gray-900 border border-gray-800 p-1.5 rounded flex flex-col gap-0.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-blue-300 font-bold">{job.method} {job.endpoint}</span>
                    <StatusChip status={job.status} />
                  </div>
                  <div className="flex items-center gap-3 text-gray-400">
                    <span>entity: <span className="text-gray-200">{job.entityType}</span></span>
                    <span>op: <span className="text-gray-200">{job.operation}</span></span>
                    <span>attempts: <span className="text-yellow-400">{job.attempts}</span></span>
                    <span>strategy: <span className="text-purple-300">{job.conflictStrategy}</span></span>
                  </div>
                  {job.error && (
                    <span className="text-red-400 break-all">{job.error}</span>
                  )}
                  {job.nextRetryAt && job.nextRetryAt > Date.now() && (
                    <span className="text-gray-500">
                      retry in {Math.ceil((job.nextRetryAt - Date.now()) / 1000)}s
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="px-3 py-1.5 border-t border-gray-800 text-gray-600 text-[9px]">
            Ctrl+Shift+S to toggle · Dev only · Not visible in production
          </div>
        </div>
      )}
    </>
  );
}
