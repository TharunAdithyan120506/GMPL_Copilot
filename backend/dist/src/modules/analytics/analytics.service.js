"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const prisma_1 = require("../../shared/prisma");
exports.AnalyticsService = {
    async getDashboardMetrics(ctx) {
        // 1. Active Moulds Count
        const activeMoulds = await prisma_1.prisma.mould.count({
            where: { companyId: ctx.companyId, lifecycleState: 'active' }
        });
        // 2. Pending Edit Requests
        const pendingEdits = await prisma_1.prisma.editRequest.count({
            where: { companyId: ctx.companyId, status: 'pending' }
        });
        // 3. Low RM Stock (Mocking logic for now: assignments where rmRemainingQty < 50)
        // Actually we can check if there are assignments approaching low balance.
        const lowRmStock = await prisma_1.prisma.assignment.count({
            where: { companyId: ctx.companyId, status: 'active', rmRemainingQty: { lt: 100 } }
        });
        // 4. Moulds Near Life Limit ( > 90% of shotLifeLimit )
        // Prisma doesn't natively support comparing two columns directly easily without raw SQL,
        // so we'll fetch moulds and filter in memory since it's a small set.
        const moulds = await prisma_1.prisma.mould.findMany({
            where: { companyId: ctx.companyId, lifecycleState: 'active' },
            select: { shotCountAccumulated: true, shotLifeLimit: true }
        });
        const nearLimitMoulds = moulds.filter(m => {
            if (Number(m.shotLifeLimit) === 0)
                return false;
            return (Number(m.shotCountAccumulated) / Number(m.shotLifeLimit)) >= 0.9;
        }).length;
        // 5. Vendor Performance (Mock data for MVP UI)
        const vendorScores = [
            { id: '1', name: 'Vendor Alpha', score: 94, status: 'top' },
            { id: '2', name: 'Vendor Delta', score: 68, status: 'needs_attention' }
        ];
        // 6. Downtime Aggregates
        const downtime = {
            totalHours: 124,
            machine: 45,
            mould: 30,
            manpower: 15,
            other: 10
        };
        return {
            kpis: {
                activeMoulds,
                pendingEdits,
                lowRmStock,
                nearLimitMoulds
            },
            vendorScores,
            downtime
        };
    }
};
