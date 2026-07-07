/**
 * MouldRepository — server-wins, read-heavy
 */
import { db, type CachedMould } from '../lib/db';
import { pullMoulds } from '../sync/pull';
import { syncQueue } from '../lib/sync-queue';

export const MouldRepository = {
  async getAll(): Promise<CachedMould[]> {
    const arr = await db.moulds.toArray();
    return arr.sort((a, b) => a.name.localeCompare(b.name));
  },

  async getById(id: string): Promise<CachedMould | undefined> {
    return db.moulds.get(id);
  },

  refresh(force = false): void {
    pullMoulds(force).catch(() => {});
  },

  /** Queue a lifecycle transition (move-to-repair, retire, etc.) */
  async transition(mouldId: string, action: 'move-to-repair' | 'return-to-rotation' | 'retire'): Promise<void> {
    await syncQueue.enqueue({
      method: 'POST',
      endpoint: `/moulds/${mouldId}/${action}`,
      payload: {},
      entityType: 'mould',
      entityId: mouldId,
      operation: 'TRANSITION',
      conflictStrategy: 'state-machine',
    });
  },

  /** Queue revocation of a specific vendor assignment */
  async revokeAssignment(assignmentId: string): Promise<void> {
    await syncQueue.enqueue({
      method: 'DELETE',
      endpoint: `/vendors/assignments/${assignmentId}`,
      payload: {},
      entityType: 'vendor',
      entityId: assignmentId,
      operation: 'DELETE',
      conflictStrategy: 'server-wins',
    });
  },

  async create(data: any): Promise<void> {
    await syncQueue.enqueue({
      method: 'POST',
      endpoint: '/moulds',
      payload: data,
      entityType: 'mould',
      entityId: `local-${crypto.randomUUID()}`,
      operation: 'CREATE',
      conflictStrategy: 'server-wins',
    });
  }
};
