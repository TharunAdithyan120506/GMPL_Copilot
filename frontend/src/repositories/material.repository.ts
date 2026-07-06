/**
 * MaterialRepository — server-wins
 */
import { db, type CachedMaterial } from '../lib/db';
import { pullMaterials } from '../sync/pull';

export const MaterialRepository = {
  async getAll(): Promise<CachedMaterial[]> {
    const arr = await db.materials.toArray();
    return arr.sort((a, b) => a.name.localeCompare(b.name));
  },

  refresh(force = false): void {
    pullMaterials(force).catch(() => {});
  },
};
