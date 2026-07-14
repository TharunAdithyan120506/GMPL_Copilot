/**
 * OfflineBanner — Shown when the user has no internet connection or sync has failed.
 * Does NOT show a banner just for in-flight syncing (that's handled by SyncIndicator in the sidebar).
 */
import { useSyncStatus } from '../hooks/useSyncStatus';

export function OfflineBanner() {
  const { isOnline, failedCount, status } = useSyncStatus();

  // Online with no failures — no banner needed. Normal syncing is silent.
  if (isOnline && status !== 'error') return null;

  const bgClass =
    status === 'error'
      ? 'bg-danger text-on-error'
      : 'bg-on-background text-surface';

  const icon = status === 'error' ? 'error' : 'cloud_off';

  const message = !isOnline
    ? `You're offline. Data is cached locally and will sync automatically when reconnected.`
    : `${failedCount} change${failedCount > 1 ? 's' : ''} failed to sync. Please check your connection.`;

  return (
    <div className={`fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-3 px-4 py-2 text-center font-label-sm text-label-sm uppercase border-b-2 border-on-background transition-all ${bgClass}`}>
      <span className="material-symbols-outlined text-[16px]">{icon}</span>
      <span>{message}</span>
    </div>
  );
}
