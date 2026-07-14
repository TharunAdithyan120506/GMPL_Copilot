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
    const all = await db.logs.orderBy('logDate').reverse().toArray();
    return all.filter(l => l.status !== 'draft');
  },

  async getById(id: string): Promise<CachedLog | undefined> {
    return db.logs.get(id);
  },

  refresh(force = false): void {
    pullLogs(force).catch(() => {});
    db.logs.where('status').equals('draft').delete().catch(() => {});
  },

  /** Create a production log — written to local DB optimistically as submitted, queued for sync */
  async createLog(data: {
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
      status: 'submitted',
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

  /** Alias for backward compatibility */
  async createDraft(data: any): Promise<string> {
    return this.createLog(data);
  },

  /** Submit a draft log (no-op if already submitted via createLog) */
  async submitLog(logId: string, idempotencyKey: string): Promise<void> {
    const log = await db.logs.get(logId);
    if (!log || log.status === 'submitted' || log.status === 'corrected') return;
    await db.logs.update(logId, { status: 'submitted', _isOptimistic: true });

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
