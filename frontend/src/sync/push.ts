/**
 * sync/push.ts — Outbound Sync (Local → Server)
 *
 * This module owns the push pipeline:
 *   1. Reads pending jobs from the sync queue (IndexedDB)
 *   2. Fires each job as an HTTP request via the API client
 *   3. Delegates 409 Conflict responses to conflicts.ts
 *   4. Applies exponential backoff with jitter for 5xx / network failures
 *   5. Cleans up completed jobs after a grace period
 *
 * Architecture: this module does NOT import sync-queue.ts directly — it reads
 * from and writes to `db.syncQueue` through the Dexie table directly, keeping
 * the pipeline free of circular dependencies.
 *
 * The scheduler.ts module calls drain() on an interval and on reconnect.
 * The syncQueue manager in lib/sync-queue.ts also calls drain() after each enqueue.
 */
import { db, type SyncJob } from '../lib/db';
import { isOnline } from './network';
import { handleConflict } from './conflicts';
import api from '../utils/api';

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

// ─── Backoff (mirrors sync-queue.ts — keep in sync) ──────────────────────────
const BASE_DELAYS_MS = [0, 2_000, 4_000, 8_000, 16_000, 30_000];
const JITTER_FACTOR = 0.3;

function withJitter(ms: number): number {
  if (ms === 0) return 0;
  const jitter = ms * JITTER_FACTOR * (Math.random() * 2 - 1);
  return Math.max(500, ms + jitter);
}

function nextRetryDelay(attempts: number): number {
  const idx = Math.min(attempts, BASE_DELAYS_MS.length - 1);
  return withJitter(BASE_DELAYS_MS[idx]);
}

// ─── State ────────────────────────────────────────────────────────────────────
let _processing = false;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Process all pending/failed jobs that are ready to retry.
 * Safe to call concurrently — only one drain runs at a time.
 */
export async function drain(): Promise<void> {
  if (_processing || !isOnline()) return;
  _processing = true;

  try {
    const now = Date.now();
    const currentUserId = getCurrentUserId();
    const readyJobs = await db.syncQueue
      .where('status').anyOf(['pending', 'failed'])
      .filter((job) => (job.nextRetryAt ?? 0) <= now && job.userId === currentUserId)
      .toArray();

    for (const job of readyJobs) {
      await processJob(job);
    }
  } finally {
    _processing = false;
  }
}

/**
 * Process a single sync job.
 * Called by drain() sequentially. Exported for testing.
 */
export async function processJob(initialJob: SyncJob): Promise<void> {
  if (!initialJob.id) return;
  
  // RELOAD JOB FROM DB!
  // If a previous CREATE job rewrote this job's foreign keys in the database,
  // the in-memory array in `drain()` will be stale. We must use the freshest version.
  const job = await db.syncQueue.get(initialJob.id);
  if (!job || job.id === undefined) return;
  const jobId = job.id;

  // Mark in-flight
  await db.syncQueue.update(jobId, {
    status: 'in-flight',
    lastAttemptAt: Date.now(),
    attempts: (job.attempts ?? 0) + 1,
  });

  try {
    const res = await api.request({
      method: job.method,
      url: job.endpoint,
      data: job.payload,
      headers: {
        ...(job.headers ?? {}),
        // Idempotency-Key: if the server already processed this mutation ID,
        // it returns success without re-applying the change (prevents duplicates on retry).
        'Idempotency-Key': job.mutationId,
      },
    });

    // ✅ Success — mark done and schedule cleanup
    await db.syncQueue.update(jobId, { status: 'done', error: null });
    
    // Offline-First Dependency Resolution:
    // If we just created a record on the server, subsequent queued mutations 
    // (like "submit log" or "edit request") might still be using the `local-xyz` temp ID.
    // We must rewrite those pending jobs with the real server UUID!
    if (job.operation === 'CREATE') {
      const realId = res.data?.data?.id;
      if (realId && typeof realId === 'string') {
        const allPending = await db.syncQueue
          .where('status').anyOf(['pending', 'failed', 'in-flight'])
          .toArray();
          
        const dependentJobs = allPending.filter(j => j.entityId === job.entityId && j.id !== job.id);
        
        for (const dep of dependentJobs) {
          if (dep.id) {
            const newEndpoint = dep.endpoint.replace(job.entityId, realId);
            
            // Rewrite any foreign keys in the payload that reference the old temp ID
            let newPayload = dep.payload;
            if (newPayload && typeof newPayload === 'object') {
              newPayload = JSON.parse(JSON.stringify(newPayload).replace(new RegExp(job.entityId, 'g'), realId));
            }

            await db.syncQueue.update(dep.id, {
              entityId: realId,
              endpoint: newEndpoint,
              payload: newPayload,
              status: dep.status === 'failed' ? 'pending' : dep.status, // Auto-retry if it failed due to bad ID
            });
          }
        }
      }
    }
    
    // Clean up optimistic local record so it is replaced by real server data on next pull
    // We only need to delete if it's a CREATE. If it's a TRANSITION, we just pull the new state.
    if (job.operation === 'CREATE') {
      const table = (db as any)[`${job.entityType}s`];
      if (table) {
        await table.delete(job.entityId).catch(() => {});
      }
    }

    // Always trigger a refresh in the background to fetch the new real record
    // This is vital for TRANSITION (submit) as well, to pull the new 'submitted' state.
    import('./pull').then(m => m.pullAll(true)).catch(() => {});

    // If this was a CREATE that rewrote dependent jobs, immediately re-drain
    // so those jobs don't wait up to 60s for the next scheduler tick.
    // We set _processing = false first so the recursive drain() can run.
    if (job.operation === 'CREATE') {
      _processing = false;
      drain().catch(() => {});
    }
    
    scheduleCleanup(jobId);
  } catch (err: any) {
    const httpStatus = err?.response?.status;
    const serverMessage =
      err?.response?.data?.error?.message ?? err?.message ?? 'Unknown error';

    // 409 Conflict — delegate to conflict resolution strategy
    if (httpStatus === 409) {
      await handleConflict(job, serverMessage);
      return;
    }

    // 4xx (except 409) — permanent failure, do not retry
    if (httpStatus && httpStatus >= 400 && httpStatus < 500) {
      await db.syncQueue.update(jobId, {
        status: 'failed',
        error: `${httpStatus}: ${serverMessage}`,
        nextRetryAt: null, // null = no retry
      });
      return;
    }

    // Network error or 5xx — retry with exponential backoff + jitter
    const attempts = (job.attempts ?? 0) + 1;
    const delay = nextRetryDelay(attempts);
    await db.syncQueue.update(jobId, {
      status: 'failed',
      error: serverMessage,
      nextRetryAt: Date.now() + delay,
    });
  }
}

/**
 * Return the count of jobs currently waiting to be sent.
 */
export async function pendingPushCount(): Promise<number> {
  const currentUserId = getCurrentUserId();
  return db.syncQueue
    .where('status').anyOf(['pending', 'in-flight', 'failed'])
    .filter(job => job.userId === currentUserId)
    .count();
}

/**
 * Return all jobs with any terminal-error state for the devtools panel.
 */
export async function getFailedJobs(): Promise<SyncJob[]> {
  const currentUserId = getCurrentUserId();
  return db.syncQueue
    .where('status').anyOf(['failed', 'conflict'])
    .filter(job => job.userId === currentUserId)
    .toArray();
}

// ─── Internal ─────────────────────────────────────────────────────────────────

/** Auto-delete done jobs after 5 minutes to keep the queue table lean. */
function scheduleCleanup(jobId: number): void {
  setTimeout(() => {
    db.syncQueue.delete(jobId).catch(() => {});
  }, 5 * 60_000);
}
