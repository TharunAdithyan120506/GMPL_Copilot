/**
 * DashboardRepository — server-wins, short TTL (30s)
 */
import { db } from '../lib/db';
import { pullDashboard } from '../sync/pull';

export const DashboardRepository = {
  async get(): Promise<any | null> {
    const cached = await db.dashboard.get('singleton');
    return cached?.data ?? null;
  },

  refresh(force = false): void {
    pullDashboard(force).catch(() => {});
  },
};
