/**
 * SkeletonTable — first-install skeleton (§Phase 6)
 *
 * Shown ONLY when IndexedDB has never been synced (isFirstLoad = true).
 * Every subsequent visit renders cached content immediately — no skeleton.
 */

interface SkeletonTableProps {
  cols?: number;
  rows?: number;
}

export function SkeletonTable({ cols = 4, rows = 5 }: SkeletonTableProps) {
  return (
    <div className="bg-surface border-2 border-on-background neo-shadow overflow-hidden animate-pulse">
      <table className="w-full border-collapse">
        <thead className="bg-surface-variant border-b-2 border-on-background">
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="p-4">
                <div className="h-3 bg-on-background/20 rounded w-24" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y-2 divide-on-background">
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c} className="p-4">
                  <div
                    className="h-4 bg-on-background/10 rounded"
                    style={{ width: `${60 + Math.random() * 30}%` }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * SkeletonCard — for KPI / dashboard cards on first visit
 */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-surface border-2 border-on-background neo-shadow p-6 animate-pulse flex flex-col gap-3 ${className}`}>
      <div className="h-3 bg-on-background/15 rounded w-1/2" />
      <div className="h-10 bg-on-background/10 rounded w-3/4" />
      <div className="h-3 bg-on-background/10 rounded w-1/3" />
    </div>
  );
}

/**
 * FreshnessLabel — §Phase 9 semantic loading
 *
 * Instead of "Loading..." shows:
 *   "Updated 15s ago"
 *   "Refreshing..."
 *   "Offline · Cached data"
 */
interface FreshnessLabelProps {
  lastSyncedAt: number | null;
  isOnline?: boolean;
  className?: string;
}

function formatAge(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 10) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export function FreshnessLabel({ lastSyncedAt, isOnline = true, className = '' }: FreshnessLabelProps) {
  if (!lastSyncedAt) {
    return (
      <span className={`font-label-sm text-[10px] uppercase text-on-surface-variant ${className}`}>
        Syncing first data...
      </span>
    );
  }

  const age = Date.now() - lastSyncedAt;

  return (
    <span className={`font-label-sm text-[10px] uppercase flex items-center gap-1 ${isOnline ? 'text-on-surface-variant' : 'text-warning'} ${className}`}>
      {!isOnline && <span className="material-symbols-outlined text-[12px]">cloud_off</span>}
      {isOnline
        ? `Updated ${formatAge(age)}`
        : `Offline · Cached ${formatAge(age)}`}
    </span>
  );
}
