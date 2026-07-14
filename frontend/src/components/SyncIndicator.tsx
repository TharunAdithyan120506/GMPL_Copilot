/**
 * SyncIndicator — 3-state dot in the sidebar footer.
 *
 * 🟢 All synced  — no queue, online
 * 🟡 Uploading…  — jobs in flight (pulsing dot, count shown)
 * ⭕ Offline      — no connection
 * 🔴 N failed    — permanent failures needing attention + retry button
 */
import { useSyncStatus } from '../hooks/useSyncStatus';
import { syncQueue } from '../lib/sync-queue';

export function SyncIndicator() {
  const { status, pendingCount, failedCount, isOnline } = useSyncStatus();

  const dotColor =
    status === 'error'   ? 'bg-danger'  :
    status === 'pending' ? 'bg-warning' :
    'bg-success';

  let label: string;
  if (status === 'error') {
    label = `${failedCount} sync error${failedCount > 1 ? 's' : ''}`;
  } else if (!isOnline) {
    label = 'Offline — queued locally';
  } else if (pendingCount > 0) {
    label = `Uploading ${pendingCount} change${pendingCount > 1 ? 's' : ''}…`;
  } else {
    label = 'All synced';
  }

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
      <div className="relative flex h-3 w-3 shrink-0">
        {(status === 'pending' && isOnline && pendingCount > 0) && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-75`} />
        )}
        <span className={`relative inline-flex rounded-full h-3 w-3 ${dotColor}`} />
      </div>

      <span className="font-label-sm text-[10px] uppercase text-on-surface-variant flex-1 leading-tight">
        {label}
      </span>

      {status === 'error' && (
        <button
          onClick={handleRetryAll}
          title="Retry all failed syncs"
          className="text-danger hover:text-on-background transition-colors shrink-0"
        >
          <span className="material-symbols-outlined text-[14px]">refresh</span>
        </button>
      )}
    </div>
  );
}
