/**
 * LogRepository — append-only conflict strategy
 *
 * Production logs are immutable once submitted.
 * Drafts are local-only until submitted.
 * The repository enforces this by:
 *  - Writing optimistic draft records to IndexedDB immediately
 *  - Queuing the actual API call with append-only conflict strategy
 *  - Never allowing local overwrites of submitted/corrected logs
 */
import { db, type CachedLog } from '../lib/db';
import { syncQueue } from '../lib/sync-queue';
import { pullLogs } from '../sync/pull';

export const LogRepository = {
  async getAll(): Promise<CachedLog[]> {
    return db.logs.orderBy('logDate').reverse().toArray();
  },

  async getById(id: string): Promise<CachedLog | undefined> {
    return db.logs.get(id);
  },

  refresh(force = false): void {
    pullLogs(force).catch(() => {});
  },

  /** Create a draft log — written to local DB optimistically, queued for sync */
  async createDraft(data: {
    assignmentId: string;
    logDate: string;
    acceptedQty: number;
    rejectedQty: number;
    dispatchedQty: number;
    downtimeReason?: string;
    downtimeMinutes?: number;
  }): Promise<string> {
    let foundMould: any = null;
    let foundAssignment: any = null;
    const allMoulds = await db.moulds.toArray();
    for (const m of allMoulds) {
      if (m.assignments) {
        const a = m.assignments.find((x: any) => x.id === data.assignmentId);
        if (a) {
          foundMould = m;
          foundAssignment = a;
          break;
        }
      }
    }

    const tempId = `local-${crypto.randomUUID()}`;
    await db.logs.put({
      id: tempId,
      vendorId: foundAssignment?.vendorId || 'local',
      mouldId: foundMould?.id || 'local',
      assignmentId: data.assignmentId,
      logDate: data.logDate,
      status: 'draft',
      acceptedQty: data.acceptedQty,
      rejectedQty: data.rejectedQty,
      dispatchedQty: data.dispatchedQty,
      shotsRun: data.acceptedQty + data.rejectedQty,
      rmConsumedQty: 0,
      downtimeMinutes: data.downtimeMinutes || null,
      downtimeReason: data.downtimeReason || null,
      mould: foundMould ? { id: foundMould.id, name: foundMould.name, code: foundMould.code } : null,
      assignment: foundAssignment,
      _syncedAt: Date.now(),
      _isOptimistic: true,
    });

    await syncQueue.enqueue({
      method: 'POST',
      endpoint: '/logs',
      payload: data,
      entityType: 'log',
      entityId: tempId,
      operation: 'CREATE',
      conflictStrategy: 'append-only',
    });
    return tempId;
  },

  /** Submit a draft log */
  async submitLog(logId: string, idempotencyKey: string): Promise<void> {
    const log = await db.logs.get(logId);
    if (log) {
      await db.logs.update(logId, { status: 'submitted', _isOptimistic: true });
    }

    // NOTE: logId may be a local temp ID (e.g. "local-abc123") if the CREATE
    // job hasn't synced yet (offline scenario). push.ts handles this automatically:
    // after the CREATE job succeeds and gets the real server ID, it rewrites all
    // subsequent queued jobs that share the same entityId, replacing the temp ID
    // in both the endpoint URL and payload. So we just enqueue with the same entityId.
    // [FIX: LOG-1] idempotencyKey must be sent as an HTTP header 'Idempotency-Key'
    // NOT in the request body. The backend reads req.headers['idempotency-key'].
    // push.ts already spreads job.headers onto each request — so this is the right place.
    await syncQueue.enqueue({
      method: 'POST',
      endpoint: `/logs/${logId}/submit`,
      payload: {},
      headers: { 'Idempotency-Key': idempotencyKey },
      entityType: 'log',
      entityId: logId,
      operation: 'TRANSITION',
      conflictStrategy: 'state-machine',
    });
  },

  /** Create edit request for a submitted log */
  async requestEdit(data: { dailyProductionLogId: string; requestedChanges: any; reason: string }): Promise<void> {
    const foundLog = await db.logs.get(data.dailyProductionLogId);
    let vendor = null;
    if (foundLog?.vendorId) {
       vendor = await db.vendors.get(foundLog.vendorId);
    }

    const tempId = `local-${crypto.randomUUID()}`;
    await db.editRequests.put({
      id: tempId,
      vendorId: foundLog?.vendorId || 'local',
      dailyProductionLogId: data.dailyProductionLogId,
      status: 'pending',
      reason: data.reason,
      requestedChanges: data.requestedChanges,
      vendor: vendor || null,
      dailyProductionLog: foundLog || null,
      _syncedAt: Date.now(),
      _isOptimistic: true,
    });

    await syncQueue.enqueue({
      method: 'POST',
      endpoint: '/edit-requests',
      payload: data,
      entityType: 'editRequest',
      entityId: tempId,
      operation: 'CREATE',
      conflictStrategy: 'state-machine',
    });
  },
};
