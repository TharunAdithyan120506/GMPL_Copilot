/**
 * OfflineBanner — Shown when the user has no internet connection.
 * Non-blocking: stays at the top, doesn't prevent app usage.
 */
import { useSyncStatus } from '../hooks/useSyncStatus';

export function OfflineBanner() {
  const { isOnline, pendingCount, failedCount, status } = useSyncStatus();

  // Online, nothing to show
  if (isOnline && status === 'synced') return null;

  const bgClass =
    status === 'error'
      ? 'bg-danger text-on-error'
      : !isOnline
      ? 'bg-on-background text-surface'
      : 'bg-warning text-on-background';

  const icon =
    status === 'error' ? 'error' : !isOnline ? 'cloud_off' : 'sync';

  const message = !isOnline
    ? `You're offline. Viewing cached data.${pendingCount > 0 ? ` ${pendingCount} change${pendingCount > 1 ? 's' : ''} will sync automatically.` : ''}`
    : status === 'error'
    ? `${failedCount} change${failedCount > 1 ? 's' : ''} failed to sync. Check your connection.`
    : `Syncing ${pendingCount} change${pendingCount > 1 ? 's' : ''}...`;

  return (
    <div className={`fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-3 px-4 py-2 text-center font-label-sm text-label-sm uppercase border-b-2 border-on-background transition-all ${bgClass}`}>
      <span className="material-symbols-outlined text-[16px]">{icon}</span>
      <span>{message}</span>
    </div>
  );
}
