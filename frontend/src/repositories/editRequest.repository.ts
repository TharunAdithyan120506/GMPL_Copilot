/**
 * EditRequestRepository — state-machine conflict strategy
 *
 * Edit requests have strict state transitions (pending→approved/rejected).
 * The repository queues decisions; if the server reports a 409 (already
 * decided), the job is marked as 'conflict' for user inspection rather
 * than silently discarded.
 */
import { db, type CachedEditRequest } from '../lib/db';
import { syncQueue } from '../lib/sync-queue';
import { pullEditRequests } from '../sync/pull';

export const EditRequestRepository = {
  async getAll(): Promise<CachedEditRequest[]> {
    return db.editRequests.orderBy('_syncedAt').reverse().toArray();
  },

  refresh(force = false): void {
    pullEditRequests(force).catch(() => {});
  },

  /** Approve or reject an edit request — queued as state-machine transition */
  async decide(requestId: string, status: 'approved' | 'rejected'): Promise<void> {
    // Optimistic local update
    await db.editRequests.update(requestId, { status, _isOptimistic: true });

    await syncQueue.enqueue({
      method: 'POST',
      endpoint: `/edit-requests/${requestId}/decide`,
      payload: { status },
      entityType: 'editRequest',
      entityId: requestId,
      operation: 'TRANSITION',
      conflictStrategy: 'state-machine',
    });
  },
};
