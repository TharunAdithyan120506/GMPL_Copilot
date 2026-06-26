import { prisma } from '../../shared/prisma';
import { AuthContext } from '../../shared/types';

export const AnalyticsService = {
  async getDashboardMetrics(ctx: AuthContext) {
    const activeMoulds = await prisma.mould.count({ where: { companyId: ctx.companyId, lifecycleState: 'active' } });
    const pendingEdits = await prisma.editRequest.count({ where: { companyId: ctx.companyId, status: 'pending' } });
    const lowRmStock = await prisma.assignment.count({ where: { companyId: ctx.companyId, status: 'active', rmRemainingQty: { lt: 100 } } });
    const moulds = await prisma.mould.findMany({ where: { companyId: ctx.companyId, lifecycleState: 'active' }, select: { shotCountAccumulated: true, shotLifeLimit: true } });
    const nearLimitMoulds = moulds.filter(m => Number(m.shotLifeLimit) > 0 && (Number(m.shotCountAccumulated) / Number(m.shotLifeLimit)) >= 0.9).length;

    // Vendor Performance (Real)
    const logs = await prisma.dailyProductionLog.findMany({ where: { companyId: ctx.companyId } });
    
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

    return {
      kpis: { activeMoulds, pendingEdits, lowRmStock, nearLimitMoulds },
      vendorScores: [{ id: '1', name: 'Vendor Alpha', score: 94, status: 'top' }], // Mock for dashboard UI
      downtime
    };
  },
  
  async getProduction(ctx: AuthContext) {
    const logs = await prisma.dailyProductionLog.findMany({ 
      where: { companyId: ctx.companyId },
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
      where: { companyId: ctx.companyId },
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
    const moulds = await prisma.mould.findMany({ where: { companyId: ctx.companyId } });
    return moulds.map(m => ({
      name: m.code,
      accumulated: Number(m.shotCountAccumulated),
      limit: Number(m.shotLifeLimit),
      percentage: Number(m.shotLifeLimit) > 0 ? (Number(m.shotCountAccumulated) / Number(m.shotLifeLimit)) * 100 : 0
    }));
  }
};
