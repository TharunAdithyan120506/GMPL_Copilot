import { prisma } from '../../shared/prisma';
import { AuthContext } from '../../shared/types';

export const AnalyticsService = {
  async getDashboardMetrics(ctx: AuthContext) {
    const activeMoulds = await prisma.mould.count({ where: { companyId: ctx.companyId, lifecycleState: 'active', deletedAt: null } });
    const pendingEdits = await prisma.editRequest.count({ where: { companyId: ctx.companyId, status: 'pending' } });
    const lowRmStock = await prisma.assignment.count({ where: { companyId: ctx.companyId, status: 'active', deletedAt: null, rmRemainingQty: { lt: 100 } } });
    const moulds = await prisma.mould.findMany({ where: { companyId: ctx.companyId, lifecycleState: 'active', deletedAt: null }, select: { shotCountAccumulated: true, shotLifeLimit: true } });
    const nearLimitMoulds = moulds.filter(m => Number(m.shotLifeLimit) > 0 && (Number(m.shotCountAccumulated) / Number(m.shotLifeLimit)) >= 0.9).length;

    const logs = await prisma.dailyProductionLog.findMany({
      where: { companyId: ctx.companyId, deletedAt: null },
      include: { vendor: { select: { id: true, name: true } } },
    });
    
    // Downtime Aggregates
    const downtime = { totalHours: 0, machine: 0, mould: 0, manpower: 0, other: 0 };
    logs.forEach(l => {
      if (l.downtimeMinutes) {
        downtime.totalHours += l.downtimeMinutes / 60;
        if (l.downtimeReason === 'machine') downtime.machine += l.downtimeMinutes;
        else if (l.downtimeReason === 'mould') downtime.mould += l.downtimeMinutes;
        else if (l.downtimeReason === 'manpower') downtime.manpower += l.downtimeMinutes;
        else downtime.other += l.downtimeMinutes;
      }
    });

    const totalDowntimeMin = downtime.machine + downtime.mould + downtime.manpower + downtime.other;
    if (totalDowntimeMin > 0) {
      downtime.machine = Math.round((downtime.machine / totalDowntimeMin) * 100);
      downtime.mould = Math.round((downtime.mould / totalDowntimeMin) * 100);
      downtime.manpower = Math.round((downtime.manpower / totalDowntimeMin) * 100);
      downtime.other = 100 - (downtime.machine + downtime.mould + downtime.manpower);
    }

    const vendorMap = new Map<string, { id: string; name: string; accepted: number; rejected: number; downtime: number }>();
    logs.forEach((log) => {
      const current = vendorMap.get(log.vendor.id) ?? {
        id: log.vendor.id,
        name: log.vendor.name,
        accepted: 0,
        rejected: 0,
        downtime: 0,
      };
      current.accepted += Number(log.acceptedQty);
      current.rejected += Number(log.rejectedQty);
      current.downtime += log.downtimeMinutes ?? 0;
      vendorMap.set(log.vendor.id, current);
    });

    const vendorScores = Array.from(vendorMap.values())
      .map((vendor) => {
        const total = vendor.accepted + vendor.rejected;
        const acceptanceRate = total > 0 ? vendor.accepted / total : 0;
        const downtimePenalty = Math.min(20, vendor.downtime / 60);
        const score = Math.max(0, Math.round((acceptanceRate * 100) - downtimePenalty));
        return {
          id: vendor.id,
          name: vendor.name,
          score,
          status: score >= 85 ? 'top' : score >= 70 ? 'steady' : 'attention',
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const productionSeries = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (13 - index));
      const key = date.toISOString().split('T')[0];
      return { date: key, accepted: 0, rejected: 0, total: 0 };
    });
    const productionByDate = new Map(productionSeries.map(point => [point.date, point]));

    logs.forEach((log) => {
      const key = log.logDate.toISOString().split('T')[0];
      const point = productionByDate.get(key);
      if (!point) return;

      point.accepted += Number(log.acceptedQty);
      point.rejected += Number(log.rejectedQty);
      point.total = point.accepted + point.rejected;
    });

    return {
      kpis: { activeMoulds, pendingEdits, lowRmStock, nearLimitMoulds },
      vendorScores,
      downtime,
      productionSeries,
    };
  },
  
  async getProduction(ctx: AuthContext) {
    const logs = await prisma.dailyProductionLog.findMany({ 
      where: { companyId: ctx.companyId, deletedAt: null, status: { in: ['submitted', 'corrected'] } },
      include: { vendor: true, mould: true }
    });
    return logs.map(l => ({
      date: l.logDate.toISOString().split('T')[0],
      vendor: l.vendor.name,
      mould: l.mould.code,
      accepted: Number(l.acceptedQty),
      rejected: Number(l.rejectedQty)
    }));
  },

  async getMaterials(ctx: AuthContext) {
    const assignments = await prisma.assignment.findMany({
      where: { companyId: ctx.companyId, deletedAt: null },
      include: { rawMaterial: true, vendor: true }
    });
    return assignments.map(a => ({
      vendor: a.vendor.name,
      material: a.rawMaterial.name,
      assigned: Number(a.rmAssignedQty),
      consumed: Number(a.rmConsumedQty),
      loss: Number(a.rmIrrecoverableLossQty),
      remaining: Number(a.rmRemainingQty)
    }));
  },

  async getMouldLife(ctx: AuthContext) {
    const moulds = await prisma.mould.findMany({
      where: { companyId: ctx.companyId, deletedAt: null },
      include: {
        assignments: {
          where: { status: 'active', deletedAt: null },
          include: { vendor: { select: { id: true, name: true, code: true } } },
          orderBy: { assignedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const items = moulds.map((m) => {
      const accumulated = Number(m.shotCountAccumulated);
      const limit = Number(m.shotLifeLimit);
      const percentage = limit > 0 ? (accumulated / limit) * 100 : 0;
      const remainingShots = Math.max(0, limit - accumulated);
      const riskLevel = percentage >= 100
        ? 'expired'
        : percentage >= 90
          ? 'critical'
          : percentage >= 75
            ? 'watch'
            : 'healthy';
      const assignment = m.assignments[0];

      return {
        id: m.id,
        code: m.code,
        name: m.name,
        lifecycleState: m.lifecycleState,
        accumulated,
        limit,
        remainingShots,
        percentage,
        riskLevel,
        vendor: assignment?.vendor
          ? { id: assignment.vendor.id, code: assignment.vendor.code, name: assignment.vendor.name }
          : null,
      };
    });

    const summary = items.reduce(
      (acc, mould) => {
        acc.total += 1;
        acc[mould.riskLevel as 'healthy' | 'watch' | 'critical' | 'expired'] += 1;
        acc.byState[mould.lifecycleState] = (acc.byState[mould.lifecycleState] || 0) + 1;
        return acc;
      },
      { total: 0, healthy: 0, watch: 0, critical: 0, expired: 0, byState: {} as Record<string, number> }
    );

    return { summary, items };
  },

  async getDowntime(ctx: AuthContext) {
    const logs = await prisma.dailyProductionLog.findMany({
      where: {
        companyId: ctx.companyId,
        deletedAt: null,
        status: { in: ['submitted', 'corrected'] },
        downtimeMinutes: { gt: 0 },
      },
      include: {
        vendor: { select: { id: true, code: true, name: true } },
        mould: { select: { id: true, code: true, name: true } },
      },
      orderBy: { logDate: 'desc' },
    });

    const reasonLabels: Record<string, string> = {
      machine: 'Machine',
      mould: 'Mould',
      manpower: 'Manpower',
      power: 'Power',
      other: 'Other',
    };
    const reasonMap = new Map<string, { reason: string; label: string; minutes: number; count: number; percentage: number }>();
    const vendorMap = new Map<string, { id: string; code: string; name: string; minutes: number; count: number }>();
    const mouldMap = new Map<string, { id: string; code: string; name: string; minutes: number; count: number }>();
    const dailyMap = new Map<string, { date: string; minutes: number; count: number }>();

    let totalMinutes = 0;
    logs.forEach((log) => {
      const minutes = log.downtimeMinutes || 0;
      const reason = log.downtimeReason || 'other';
      totalMinutes += minutes;

      const reasonCurrent = reasonMap.get(reason) || { reason, label: reasonLabels[reason] || reason, minutes: 0, count: 0, percentage: 0 };
      reasonCurrent.minutes += minutes;
      reasonCurrent.count += 1;
      reasonMap.set(reason, reasonCurrent);

      const vendorCurrent = vendorMap.get(log.vendor.id) || { id: log.vendor.id, code: log.vendor.code, name: log.vendor.name, minutes: 0, count: 0 };
      vendorCurrent.minutes += minutes;
      vendorCurrent.count += 1;
      vendorMap.set(log.vendor.id, vendorCurrent);

      const mouldCurrent = mouldMap.get(log.mould.id) || { id: log.mould.id, code: log.mould.code, name: log.mould.name, minutes: 0, count: 0 };
      mouldCurrent.minutes += minutes;
      mouldCurrent.count += 1;
      mouldMap.set(log.mould.id, mouldCurrent);

      const date = log.logDate.toISOString().split('T')[0];
      const dailyCurrent = dailyMap.get(date) || { date, minutes: 0, count: 0 };
      dailyCurrent.minutes += minutes;
      dailyCurrent.count += 1;
      dailyMap.set(date, dailyCurrent);
    });

    const byReason = Array.from(reasonMap.values())
      .map(reason => ({
        ...reason,
        percentage: totalMinutes > 0 ? Math.round((reason.minutes / totalMinutes) * 100) : 0,
      }))
      .sort((a, b) => b.minutes - a.minutes);

    return {
      summary: {
        totalMinutes,
        totalHours: Number((totalMinutes / 60).toFixed(2)),
        incidentCount: logs.length,
        averageMinutes: logs.length > 0 ? Math.round(totalMinutes / logs.length) : 0,
      },
      byReason,
      byVendor: Array.from(vendorMap.values()).sort((a, b) => b.minutes - a.minutes),
      byMould: Array.from(mouldMap.values()).sort((a, b) => b.minutes - a.minutes),
      daily: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    };
  },
};
