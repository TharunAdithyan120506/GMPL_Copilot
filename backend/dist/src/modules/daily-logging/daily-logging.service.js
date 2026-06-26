"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyLoggingService = void 0;
const prisma_1 = require("../../shared/prisma");
const errors_1 = require("../../shared/errors");
const audit_service_1 = require("../../cross-cutting/audit/audit.service");
const notification_service_1 = require("../../cross-cutting/notifications/notification.service");
exports.DailyLoggingService = {
    async list(ctx, filter = {}) {
        const where = { companyId: ctx.companyId, deletedAt: null };
        if (ctx.role === 'vendor')
            where.vendorId = ctx.vendorId;
        if (filter.mouldId)
            where.mouldId = filter.mouldId;
        if (filter.assignmentId)
            where.assignmentId = filter.assignmentId;
        return prisma_1.prisma.dailyProductionLog.findMany({
            where,
            orderBy: { logDate: 'desc' },
            include: { mould: { select: { code: true, name: true } }, assignment: { select: { rawMaterial: true } } },
        });
    },
    async createDraft(ctx, data) {
        if (ctx.role !== 'vendor')
            throw errors_1.Errors.forbidden('Only vendors can log production');
        return prisma_1.prisma.$transaction(async (tx) => {
            try {
                const log = await tx.dailyProductionLog.create({
                    data: {
                        companyId: ctx.companyId,
                        vendorId: ctx.vendorId,
                        assignmentId: data.assignmentId,
                        mouldId: data.mouldId,
                        logDate: new Date(data.logDate),
                        shotsRun: data.shotsRun,
                        acceptedQty: data.acceptedQty,
                        rejectedQty: data.rejectedQty,
                        dispatchedQty: data.dispatchedQty,
                        downtimeReason: data.downtimeReason || null,
                        downtimeMinutes: data.downtimeMinutes || null,
                        shotWeightGSnapshot: 0, // Set to 0 in draft, resolved on submit
                        rmConsumedQty: 0,
                        rmIrrecoverableLossQty: 0,
                        status: 'draft',
                        createdBy: ctx.userId,
                        updatedBy: ctx.userId,
                    },
                });
                await audit_service_1.AuditService.write({
                    companyId: ctx.companyId,
                    entityType: 'daily_production_log',
                    entityId: log.id,
                    action: 'create',
                    actorUserId: ctx.userId,
                    actorRole: ctx.role,
                    after: log,
                    tx,
                });
                return log;
            }
            catch (err) {
                if (err.code === 'P2002')
                    throw errors_1.Errors.conflict('A log already exists for this mould and date');
                throw err;
            }
        });
    },
    async submit(ctx, id, idempotencyKey) {
        if (ctx.role !== 'vendor')
            throw errors_1.Errors.forbidden('Only vendors can submit logs');
        // Basic idempotent lock check (using jobs table or a separate lock mechanism)
        // For V1, we check if the log is already submitted.
        const current = await prisma_1.prisma.dailyProductionLog.findUnique({ where: { id, companyId: ctx.companyId } });
        if (!current)
            throw errors_1.Errors.notFound('Log');
        if (current.status !== 'draft')
            throw errors_1.Errors.stateTransition('Only draft logs can be submitted');
        return prisma_1.prisma.$transaction(async (tx) => {
            // 1. Lock the log row
            const [log] = await tx.$queryRaw `SELECT * FROM daily_production_logs WHERE id = ${id}::uuid FOR UPDATE`;
            if (!log)
                throw errors_1.Errors.notFound('Log');
            const assignment = await tx.assignment.findUnique({ where: { id: log.assignment_id } });
            const mould = await tx.mould.findUnique({ where: { id: log.mould_id } });
            if (!assignment || !mould)
                throw errors_1.Errors.internal('Data integrity error');
            // 2. System calculates Total Parts and Shots Run
            const totalParts = Number(log.accepted_qty) + Number(log.rejected_qty);
            if (totalParts % Number(mould.cavityCount) !== 0) {
                throw { code: 'VALIDATION_ERROR', message: `Total parts (${totalParts}) is not perfectly divisible by mould cavity count (${mould.cavityCount}).`, status: 400 };
            }
            const calculatedShotsRun = totalParts / Number(mould.cavityCount);
            // 3. Snapshot shot_weight_g from mould
            const shotWeightG = mould.shotWeightG;
            // 4. Compute rm_consumed_qty = shots_run × shot_weight_g_snapshot (converted to kg for RM unit)
            const rmConsumedKg = (calculatedShotsRun * Number(shotWeightG)) / 1000;
            // 4. Compute rm_irrecoverable_loss_qty (Assuming 1% of consumed for V1, PRD noted editable formula)
            const irrecoverableLossKg = rmConsumedKg * 0.01;
            // Update the log
            const updatedLog = await tx.dailyProductionLog.update({
                where: { id },
                data: {
                    status: 'submitted',
                    shotsRun: calculatedShotsRun,
                    shotWeightGSnapshot: shotWeightG,
                    rmConsumedQty: rmConsumedKg,
                    rmIrrecoverableLossQty: irrecoverableLossKg,
                    updatedBy: ctx.userId,
                },
            });
            // 5. Decrement assignment balances
            await tx.assignment.update({
                where: { id: assignment.id },
                data: {
                    rmConsumedQty: { increment: rmConsumedKg },
                    rmIrrecoverableLossQty: { increment: irrecoverableLossKg },
                    rmRemainingQty: { decrement: (rmConsumedKg + irrecoverableLossKg) },
                    updatedBy: ctx.userId,
                },
            });
            // 6. Increment mould shot count
            const updatedMould = await tx.mould.update({
                where: { id: mould.id },
                data: {
                    shotCountAccumulated: { increment: calculatedShotsRun },
                    updatedBy: ctx.userId,
                },
            });
            // 7. Shot-life threshold check
            if (Number(updatedMould.shotCountAccumulated) >= Number(mould.shotLifeLimit) && mould.lifecycleState === 'active') {
                await tx.mould.update({ where: { id: mould.id }, data: { lifecycleState: 'flagged_for_replacement', updatedBy: ctx.userId } });
                await tx.mouldLifecycleEvent.create({
                    data: {
                        companyId: ctx.companyId,
                        mouldId: mould.id,
                        eventType: 'flagged_for_replacement',
                        fromState: 'active',
                        toState: 'flagged_for_replacement',
                        shotCountAtEvent: updatedMould.shotCountAccumulated,
                        triggerKind: 'automatic',
                        createdBy: ctx.userId || '',
                    }
                });
                await notification_service_1.NotificationService.enqueue(ctx.companyId, 'MOULD_LIFE_WARNING', { mouldId: mould.id, mouldName: mould.name });
            }
            // 8. Audit log
            await audit_service_1.AuditService.write({
                companyId: ctx.companyId,
                entityType: 'daily_production_log',
                entityId: log.id,
                action: 'state_transition',
                actorUserId: ctx.userId,
                actorRole: ctx.role,
                before: current,
                after: updatedLog,
                tx,
            });
            return updatedLog;
        });
    }
};
