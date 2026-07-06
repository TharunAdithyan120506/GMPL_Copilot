/**
 * SyncIndicator — 3-state dot in the sidebar footer.
 *
 * 🟢 synced   — all clear
 * 🟡 pending  — offline or uploading changes
 * 🔴 error    — sync failure requiring attention
 */
import { useSyncStatus } from '../hooks/useSyncStatus';
import { syncQueue } from '../lib/sync-queue';

export function SyncIndicator() {
  const { status, pendingCount, failedCount, isOnline } = useSyncStatus();

  const dotColor =
    status === 'error' ? 'bg-danger' :
    status === 'pending' ? 'bg-warning' :
    'bg-success';

  const label =
    status === 'error' ? `${failedCount} failed` :
    status === 'pending' ? (isOnline ? `Syncing ${pendingCount}…` : 'Offline') :
    'All synced';

  const handleRetryAll = async () => {
    const jobs = await syncQueue.allJobs();
    for (const job of jobs) {
      if ((job.status === 'failed' || job.status === 'conflict') && job.id) {
        await syncQueue.retry(job.id);
      }
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-t border-on-background/20">
      {/* Pulsing dot */}
      <div className="relative flex h-3 w-3">
        {status === 'pending' && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-75`} />
        )}
        <span className={`relative inline-flex rounded-full h-3 w-3 ${dotColor}`} />
      </div>

      <span className="font-label-sm text-[10px] uppercase text-on-surface-variant flex-1">
        {label}
      </span>

      {status === 'error' && (
        <button
          onClick={handleRetryAll}
          title="Retry failed syncs"
          className="text-danger hover:text-on-background transition-colors"
        >
          <span className="material-symbols-outlined text-[14px]">refresh</span>
        </button>
      )}
    </div>
  );
}
