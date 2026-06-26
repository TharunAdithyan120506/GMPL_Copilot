"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepairService = void 0;
const prisma_1 = require("../../shared/prisma");
const errors_1 = require("../../shared/errors");
exports.RepairService = {
    async list(ctx) {
        if (ctx.role !== 'company')
            throw errors_1.Errors.forbidden('Only company can view all repairs');
        return prisma_1.prisma.repairRecord.findMany({
            where: { companyId: ctx.companyId, deletedAt: null },
            include: {
                mould: { select: { code: true, name: true } },
                reporter: { select: { id: true, role: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    },
    async create(ctx, data) {
        if (ctx.role !== 'company')
            throw errors_1.Errors.forbidden('Only company can create repairs');
        // Also update mould status to in_repair
        const [, repair] = await prisma_1.prisma.$transaction([
            prisma_1.prisma.mould.update({
                where: { id: data.mouldId },
                data: { lifecycleState: 'in_repair' }
            }),
            prisma_1.prisma.repairRecord.create({
                data: {
                    companyId: ctx.companyId,
                    mouldId: data.mouldId,
                    reportedBy: ctx.userId,
                    status: 'transit',
                    issueDescription: data.issueDescription,
                    openedAt: new Date(),
                    createdBy: ctx.userId,
                    updatedBy: ctx.userId
                }
            })
        ]);
        return repair;
    },
    async updateStatus(ctx, id, status, reworkDescription) {
        if (ctx.role !== 'company')
            throw errors_1.Errors.forbidden('Only company can update repairs');
        const validStatuses = ['transit', 'repair', 'ready', 'scrapped'];
        if (!validStatuses.includes(status))
            throw errors_1.Errors.validation([{ field: 'status', issue: 'Invalid status' }]);
        const updateData = { status, updatedBy: ctx.userId };
        if (reworkDescription)
            updateData.reworkDescription = reworkDescription;
        if (status === 'scrapped' || status === 'ready') {
            updateData.closedAt = new Date();
        }
        const repair = await prisma_1.prisma.repairRecord.update({
            where: { id },
            data: updateData
        });
        // If ready, put mould back to active
        // If scrapped, put mould to retired
        if (status === 'ready') {
            await prisma_1.prisma.mould.update({ where: { id: repair.mouldId }, data: { lifecycleState: 'active' } });
        }
        else if (status === 'scrapped') {
            await prisma_1.prisma.mould.update({ where: { id: repair.mouldId }, data: { lifecycleState: 'retired' } });
        }
        return repair;
    }
};
