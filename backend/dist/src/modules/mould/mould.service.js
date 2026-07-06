"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MouldService = void 0;
const prisma_1 = require("../../shared/prisma");
const errors_1 = require("../../shared/errors");
const audit_service_1 = require("../../cross-cutting/audit/audit.service");
function activeAssignmentInclude(ctx) {
    return {
        assignments: {
            where: {
                status: 'active',
                deletedAt: null,
                ...(ctx.role === 'vendor' ? { vendorId: ctx.vendorId } : {}),
            },
            include: {
                vendor: { select: { id: true, code: true, name: true, isActive: true } },
                rawMaterial: { select: { id: true, code: true, name: true, unit: true } },
            },
            orderBy: { assignedAt: 'desc' },
        },
    };
}
exports.MouldService = {
    async list(ctx) {
        const where = { companyId: ctx.companyId, deletedAt: null };
        // Vendor can only see moulds on active assignments they own
        if (ctx.role === 'vendor') {
            where.assignments = { some: { vendorId: ctx.vendorId, status: 'active' } };
        }
        return prisma_1.prisma.mould.findMany({
            where,
            include: activeAssignmentInclude(ctx),
            orderBy: { name: 'asc' },
        });
    },
    async get(ctx, id) {
        const where = { id, companyId: ctx.companyId, deletedAt: null };
        if (ctx.role === 'vendor') {
            where.assignments = { some: { vendorId: ctx.vendorId, status: 'active' } };
        }
        const mould = await prisma_1.prisma.mould.findUnique({ where, include: activeAssignmentInclude(ctx) });
        if (!mould)
            throw errors_1.Errors.notFound('Mould');
        return mould;
    },
    async create(ctx, data) {
        const shotWeightG = (data.runnerWeightG || 0) + ((data.partWeightG || 0) * (data.cavityCount || 1));
        return prisma_1.prisma.$transaction(async (tx) => {
            const mould = await tx.mould.create({
                data: {
                    companyId: ctx.companyId,
                    code: data.code,
                    name: data.name,
                    cavityCount: data.cavityCount,
                    partWeightG: data.partWeightG,
                    runnerWeightG: data.runnerWeightG,
                    shotWeightG,
                    shotLifeLimit: data.shotLifeLimit || 500000,
                    lifecycleState: 'active',
                    createdBy: ctx.userId,
                    updatedBy: ctx.userId,
                },
            });
            await tx.mouldLifecycleEvent.create({
                data: {
                    companyId: ctx.companyId,
                    mouldId: mould.id,
                    eventType: 'activated',
                    toState: 'active',
                    shotCountAtEvent: 0,
                    triggeredBy: ctx.userId,
                    triggerKind: 'manual',
                    createdBy: ctx.userId,
                },
            });
            await audit_service_1.AuditService.write({
                companyId: ctx.companyId,
                entityType: 'mould',
                entityId: mould.id,
                action: 'create',
                actorUserId: ctx.userId,
                actorRole: ctx.role,
                after: mould,
                tx,
            });
            return mould;
        });
    },
    async transitionState(ctx, id, toState, eventType) {
        const VALID_TRANSITIONS = {
            active: ['in_repair', 'flagged_for_replacement', 'retired'],
            flagged_for_replacement: ['in_repair', 'retired'],
            in_repair: ['active'],
            retired: [], // terminal state — no transitions out
        };
        return prisma_1.prisma.$transaction(async (tx) => {
            const mould = await tx.mould.findUnique({ where: { id, companyId: ctx.companyId } });
            if (!mould || mould.deletedAt)
                throw errors_1.Errors.notFound('Mould');
            const allowedTargets = VALID_TRANSITIONS[mould.lifecycleState] || [];
            if (!allowedTargets.includes(toState)) {
                throw errors_1.Errors.stateTransition(`Cannot transition mould from '${mould.lifecycleState}' to '${toState}'`);
            }
            const updated = await tx.mould.update({
                where: { id },
                data: { lifecycleState: toState, updatedBy: ctx.userId },
            });
            await tx.mouldLifecycleEvent.create({
                data: {
                    companyId: ctx.companyId,
                    mouldId: mould.id,
                    eventType,
                    fromState: mould.lifecycleState,
                    toState,
                    shotCountAtEvent: mould.shotCountAccumulated,
                    triggeredBy: ctx.userId,
                    triggerKind: 'manual',
                    createdBy: ctx.userId,
                },
            });
            await audit_service_1.AuditService.write({
                companyId: ctx.companyId,
                entityType: 'mould',
                entityId: id,
                action: 'state_transition',
                actorUserId: ctx.userId,
                actorRole: ctx.role,
                before: mould,
                after: updated,
                tx,
            });
            return updated;
        });
    }
};
