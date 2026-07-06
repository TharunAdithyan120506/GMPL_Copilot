/**
 * sync/conflicts.ts — Conflict Resolution Handlers
 *
 * When a push job returns a 409 Conflict, this module decides what to do
 * based on the job's conflictStrategy.
 *
 * Per-table strategies (from offline plan §17):
 *   server-wins   → discard local job silently; re-pull the table to get fresh state
 *   append-only   → production logs — mark as conflict, notify user (log already exists)
 *   state-machine → edit requests — mark as conflict, surface in SyncIndicator
 *   local-only    → drafts — never sent to server, so conflict is impossible
 */
import { db, type SyncJob, type ConflictStrategy } from '../lib/db';
import { pullVendors, pullMoulds, pullMaterials, pullLogs, pullEditRequests } from './pull';

// ─── Re-pull map ──────────────────────────────────────────────────────────────
// When server-wins is chosen, re-pull the affected table to sync local state.
const RE_PULL_MAP: Record<string, () => Promise<void>> = {
  vendor:      () => pullVendors(true),
  material:    () => pullMaterials(true),
  mould:       () => pullMoulds(true),
  log:         () => pullLogs(true),
  editRequest: () => pullEditRequests(true),
};

// ─── Conflict result type ─────────────────────────────────────────────────────
export type ConflictResolution = 'discarded' | 'user-action-required' | 'ignored';

/**
 * Handle a 409 Conflict response for a given job.
 *
 * @returns
 *   'discarded'            — job removed, table re-pulled (server-wins)
 *   'user-action-required' — job marked 'conflict', user must resolve
 *   'ignored'              — shouldn't happen for local-only strategy
 */
export async function handleConflict(
  job: SyncJob,
  serverMessage: string,
): Promise<ConflictResolution> {
  if (!job.id) return 'ignored';

  const strategy: ConflictStrategy = job.conflictStrategy;

  switch (strategy) {
    case 'server-wins': {
      // Server already has the correct state — silently discard the job.
      await db.syncQueue.update(job.id, { status: 'done', error: null });
      // Re-pull the affected table so local DB reflects the server truth.
      const rePull = RE_PULL_MAP[job.entityType];
      if (rePull) rePull().catch(() => {}); // fire-and-forget
      return 'discarded';
    }

    case 'append-only': {
      // Production log already exists for this vendor+mould+date.
      // This is a real conflict — surface it to the user.
      await db.syncQueue.update(job.id, {
        status: 'conflict',
        error: serverMessage || 'A record already exists for this date. Cannot create duplicate.',
      });
      return 'user-action-required';
    }

    case 'state-machine': {
      // Edit request or log transition was rejected because the entity
      // has already moved to a terminal state (e.g. already approved/rejected).
      await db.syncQueue.update(job.id, {
        status: 'conflict',
        error: serverMessage || 'This action conflicts with the current state on the server.',
      });
      // Re-pull to get the updated state
      const rePull = RE_PULL_MAP[job.entityType];
      if (rePull) rePull().catch(() => {});
      return 'user-action-required';
    }

    case 'local-only': {
      // Drafts are never sent to the server — a conflict here is a bug.
      console.error('[conflicts] local-only job somehow reached the server:', job);
      await db.syncQueue.update(job.id, { status: 'done', error: null });
      return 'ignored';
    }

    default: {
      // Unknown strategy — treat as user-action-required to be safe
      await db.syncQueue.update(job.id, {
        status: 'conflict',
        error: serverMessage || 'Conflict detected.',
      });
      return 'user-action-required';
    }
  }
}

/**
 * Check if there are any unresolved conflicts that need user attention.
 */
export async function hasUnresolvedConflicts(): Promise<boolean> {
  const count = await db.syncQueue.where('status').equals('conflict').count();
  return count > 0;
}

/**
 * Get all jobs that require user action to resolve.
 */
export async function getConflictJobs(): Promise<SyncJob[]> {
  return db.syncQueue.where('status').equals('conflict').toArray();
}

/**
 * Dismiss a conflict job — user acknowledges and discards the local change.
 */
export async function dismissConflict(jobId: number): Promise<void> {
  await db.syncQueue.update(jobId, { status: 'done', error: 'Dismissed by user' });
}

/**
 * Force-retry a conflict job — user wants to try pushing their local change again.
 */
export async function retryConflict(jobId: number): Promise<void> {
  await db.syncQueue.update(jobId, {
    status: 'pending',
    nextRetryAt: Date.now(),
    error: null,
  });
}
