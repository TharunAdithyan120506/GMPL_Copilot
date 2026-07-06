/**
 * VendorRepository
 *
 * Single access point for all vendor data.
 * Components never know if data comes from IndexedDB or the network.
 *
 * Conflict strategy: server-wins (read-heavy, no local edits)
 */
import { db, type CachedVendor } from '../lib/db';
import { syncQueue } from '../lib/sync-queue';
import { pullVendors } from '../sync/pull';

export const VendorRepository = {
  /** Read all vendors from local DB. Returns stale data instantly. */
  async getAll(): Promise<CachedVendor[]> {
    return db.vendors.orderBy('name').toArray();
  },

  /** Trigger a background pull from the server (non-blocking). */
  refresh(force = false): void {
    pullVendors(force).catch(() => {});
  },

  /** Create a vendor — queued for sync, returns optimistic local record. */
  async create(data: { code: string; name: string; isInternal?: boolean; sharedLoginId?: string; initialPassword?: string }): Promise<CachedVendor> {
    const tempId = `local-${crypto.randomUUID()}`;
    const optimistic: CachedVendor = {
      id: tempId,
      code: data.code,
      name: data.name,
      isInternal: data.isInternal ?? false,
      isActive: true,
      sharedLoginId: data.sharedLoginId ?? null,
      _syncedAt: Date.now(),
      _version: 1,
    };

    await db.vendors.put(optimistic);

    await syncQueue.enqueue({
      method: 'POST',
      endpoint: '/vendors',
      payload: data,
      entityType: 'vendor',
      entityId: tempId,
      operation: 'CREATE',
      conflictStrategy: 'server-wins',
    });

    return optimistic;
  },

  /** Assign a mould to a vendor — queued for sync */
  async assign(data: { vendorId: string; mouldId: string; rawMaterialId: string; rmAssignedQty: number }): Promise<void> {
    await syncQueue.enqueue({
      method: 'POST',
      endpoint: '/vendors/assignments',
      payload: data,
      entityType: 'vendor', // Close enough for sync grouping
      entityId: `local-${crypto.randomUUID()}`,
      operation: 'CREATE',
      conflictStrategy: 'server-wins',
    });
  },
};
