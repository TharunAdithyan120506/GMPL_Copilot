/**
 * sync/scheduler.ts — Background Sync Scheduler
 *
 * Triggers sync on:
 *  1. App startup (boot)        → full pull + drain queue
 *  2. Window focus              → full pull + drain queue
 *  3. Reconnect (back online)   → force-pull + drain queue
 *  4. Periodic interval         → every 60s full pull, every 30s dashboard
 *
 * Uses push.drain() for outbound mutations and pull.ts functions for inbound.
 * Never blocks the UI thread.
 */
import { pullAll, pullDashboard } from './pull';
import { drain as pushDrain } from './push';
import { onReconnect } from './network';
import { connectivity } from '../lib/connectivity';

const PERIODIC_INTERVAL_MS = 60_000;   // 1 minute — full pull
const DASHBOARD_INTERVAL_MS = 30_000;  // 30 sec — dashboard-only

class SyncScheduler {
  private _periodicTimer: ReturnType<typeof setInterval> | null = null;
  private _dashboardTimer: ReturnType<typeof setInterval> | null = null;
  private _started = false;

  start(): void {
    if (this._started) return;
    this._started = true;

    // 1. Boot — pull everything, then drain any pending mutations
    this._syncAll(false);

    // 2. Window focus — user returns to tab, refresh stale data
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this._syncAll(false);
      }
    });

    // 3. Reconnect — force-pull (bypass TTL) + drain queued mutations
    onReconnect(() => {
      this._syncAll(true);
    });

    // 4. Periodic full sync (respects TTL — won't hammer server if data is fresh)
    this._periodicTimer = setInterval(() => {
      if (connectivity.isOnline) this._syncAll(false);
    }, PERIODIC_INTERVAL_MS);

    // 5. Dashboard refreshes more frequently (time-sensitive KPIs)
    this._dashboardTimer = setInterval(() => {
      if (connectivity.isOnline) pullDashboard(true).catch(() => {});
    }, DASHBOARD_INTERVAL_MS);
  }

  stop(): void {
    if (this._periodicTimer) clearInterval(this._periodicTimer);
    if (this._dashboardTimer) clearInterval(this._dashboardTimer);
    this._started = false;
  }

  /** Manual full refresh — called by user pressing "Refresh" in UI. */
  async forceSync(): Promise<void> {
    return this._syncAll(true);
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private async _syncAll(force: boolean): Promise<void> {
    // Run pull and push concurrently — they operate on different tables/endpoints
    await Promise.allSettled([
      pullAll(force),
      pushDrain(),
    ]);
  }
}

export const syncScheduler = new SyncScheduler();
