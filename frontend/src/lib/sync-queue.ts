/**
 * GMPL Copilot — Sync Queue Manager
 *
 * Public API for enqueueing outbound mutations.
 * The actual HTTP pipeline (drain, retry, backoff, conflict) lives in sync/push.ts.
 * This class is a thin manager: enqueue → notify → delegate drain to push.ts.
 *
 * Keeping them separate avoids circular imports and keeps push.ts independently testable.
 */
import { db, type SyncJob, type ConflictStrategy } from './db';
import { connectivity } from './connectivity';

// push.ts is imported lazily to avoid circular deps (push imports db, queue imports db)
// We use a dynamic import so the module graph stays clean.
async function getPushDrain(): Promise<() => Promise<void>> {
  const { drain } = await import('../sync/push');
  return drain;
}

// ─── Crypto-safe UUID ────────────────────────────────────
function uuid(): string {
  return crypto.randomUUID();
}

function getCurrentUserId(): string {
  const saved = localStorage.getItem('gmpl_user');
  if (!saved) return 'anonymous';
  try {
    const user = JSON.parse(saved);
    return user.id || 'anonymous';
  } catch {
    return 'anonymous';
  }
}

// ─── Enqueue input type ──────────────────────────────────
export interface EnqueueOptions {
  method: SyncJob['method'];
  endpoint: string;
  payload: any;
  entityType: string;
  entityId: string;
  operation: SyncJob['operation'];
  conflictStrategy: ConflictStrategy;
  headers?: Record<string, string>;
}

type QueueListener = () => void;

class SyncQueueManager {
  private _listeners: Set<QueueListener> = new Set();

  constructor() {
    // On reconnect, drain pending mutations
    connectivity.subscribe(online => {
      if (online) this.drain();
    });

    // Auto-notify all subscribers whenever any write/delete hits the syncQueue table directly.
    // This is critical: push.ts deletes completed jobs directly via db.syncQueue.delete()
    // and updates in-flight status via db.syncQueue.update() — both bypass this manager.
    // Dexie hooks ensure the UI (SyncIndicator, OfflineBanner) always sees fresh counts.
    const notifyFn = () => this._notify();
    db.syncQueue.hook('creating').subscribe(notifyFn);
    db.syncQueue.hook('updating').subscribe(notifyFn);
    db.syncQueue.hook('deleting').subscribe(notifyFn);
  }

  // ─── Public API ──────────────────────────────────────────

  async enqueue(options: EnqueueOptions): Promise<number> {
    const mutationId = uuid();
    const id = await db.syncQueue.add({
      mutationId,
      method: options.method,
      endpoint: options.endpoint,
      payload: options.payload,
      headers: options.headers,
      entityType: options.entityType,
      entityId: options.entityId,
      operation: options.operation,
      conflictStrategy: options.conflictStrategy,
      userId: getCurrentUserId(),
      status: 'pending',
      attempts: 0,
      lastAttemptAt: null,
      nextRetryAt: Date.now(),
      createdAt: Date.now(),
      error: null,
    });
    // _notify() is triggered automatically by the Dexie 'creating' hook above
    this.drain();
    return id as number;
  }

  /**
   * Count of jobs actively waiting to upload:
   *  - 'pending'   → queued, not yet picked up by the drain loop
   *  - 'in-flight' → actively uploading right now
   * Does NOT include 'done', 'failed', or 'conflict'.
   * Failed jobs are surfaced via failedCount() separately.
   */
  async pendingCount(): Promise<number> {
    const userId = getCurrentUserId();
    return db.syncQueue
      .where('status')
      .anyOf(['pending', 'in-flight'])
      .filter(job => job.userId === userId)
      .count();
  }

  /**
   * Count of jobs that have permanently or transiently failed.
   * These require user attention (retry or dismiss).
   */
  async failedCount(): Promise<number> {
    const userId = getCurrentUserId();
    return db.syncQueue
      .where('status')
      .anyOf(['failed', 'conflict'])
      .filter(job => job.userId === userId)
      .count();
  }

  async allJobs(): Promise<SyncJob[]> {
    const userId = getCurrentUserId();
    return db.syncQueue
      .where('userId')
      .equals(userId)
      .reverse()
      .sortBy('createdAt');
  }

  async retry(jobId: number): Promise<void> {
    await db.syncQueue.update(jobId, {
      status: 'pending',
      nextRetryAt: Date.now(),
      error: null,
    });
    // _notify() triggered by Dexie 'updating' hook
    this.drain();
  }

  async dismiss(jobId: number): Promise<void> {
    await db.syncQueue.delete(jobId);
    // _notify() triggered by Dexie 'deleting' hook
  }

  subscribe(fn: QueueListener): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  // ─── Drain — delegates to push.ts ────────────────────────

  drain(): void {
    // Lazy-import push.ts to avoid circular dependency
    getPushDrain()
      .then(drainFn => drainFn())
      .catch(() => {});
    // Note: no explicit _notify() here — push.ts triggers Dexie hooks which auto-notify
  }

  // ─── Internal ────────────────────────────────────────────

  private _notify(): void {
    this._listeners.forEach(fn => fn());
  }
}

export const syncQueue = new SyncQueueManager();
