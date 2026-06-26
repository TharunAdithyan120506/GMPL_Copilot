"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EditRequestService = void 0;
const prisma_1 = require("../../shared/prisma");
const errors_1 = require("../../shared/errors");
const audit_service_1 = require("../../cross-cutting/audit/audit.service");
const notification_service_1 = require("../../cross-cutting/notifications/notification.service");
exports.EditRequestService = {
    async list(ctx, filter = {}) {
        const where = { companyId: ctx.companyId };
        // Vendors only see their own edit requests
        if (ctx.role === 'vendor') {
            where.vendorId = ctx.vendorId;
        }
        if (filter.status)
            where.status = filter.status;
        return prisma_1.prisma.editRequest.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                vendor: { select: { name: true, code: true } },
                dailyProductionLog: { select: { id: true, logDate: true, acceptedQty: true, rejectedQty: true } }
            }
        });
    },
    async create(ctx, data) {
        if (ctx.role !== 'vendor')
            throw errors_1.Errors.forbidden('Only vendors can request edits');
        const log = await prisma_1.prisma.dailyProductionLog.findFirst({
            where: { id: data.dailyProductionLogId, companyId: ctx.companyId, vendorId: ctx.vendorId }
        });
        if (!log)
            throw errors_1.Errors.notFound('Production log not found');
        if (log.status !== 'submitted' && log.status !== 'locked') {
            throw errors_1.Errors.stateTransition('Can only edit submitted logs');
        }
        return prisma_1.prisma.$transaction(async (tx) => {
            const req = await tx.editRequest.create({
                data: {
                    companyId: ctx.companyId,
                    vendorId: ctx.vendorId,
                    dailyProductionLogId: log.id,
                    requestedChanges: data.requestedChanges, // e.g. { acceptedQty: 500, rejectedQty: 10 }
                    reason: data.reason,
                    status: 'pending',
                    createdBy: ctx.userId
                }
            });
            await audit_service_1.AuditService.write({
                tx,
                companyId: ctx.companyId,
                entityType: 'edit_request',
                entityId: req.id,
                action: 'create',
                actorUserId: ctx.userId,
                actorRole: ctx.role,
                after: req
            });
            await notification_service_1.NotificationService.enqueue(ctx.companyId, 'edit_request_created', {
                editRequestId: req.id,
                vendorId: ctx.vendorId,
                logId: log.id
            });
            return req;
        });
    },
    async decide(ctx, id, data) {
        if (ctx.role !== 'company') {
            throw errors_1.Errors.forbidden('Only company admins can decide on edit requests');
        }
        return prisma_1.prisma.$transaction(async (tx) => {
            const req = await tx.editRequest.findUnique({
                where: { id, companyId: ctx.companyId },
                include: { dailyProductionLog: true }
            });
            if (!req)
                throw errors_1.Errors.notFound('Edit request not found');
            if (req.status !== 'pending')
                throw errors_1.Errors.stateTransition('Request is already processed');
            const updatedReq = await tx.editRequest.update({
                where: { id },
                data: {
                    status: data.status,
                    decidedBy: ctx.userId,
                    decidedAt: new Date(),
                    decisionNote: data.decisionNote,
                    updatedBy: ctx.userId
                }
            });
            // If approved, we need to update the actual daily production log
            if (data.status === 'approved') {
                const changes = req.requestedChanges;
                // This is a simplified application of changes. In a real scenario, changing log qtys
                // requires recalculating RM consumed, shot counts on moulds, and assignment RM balances.
                // For the sake of MVP, we will just update the log's fields.
                await tx.dailyProductionLog.update({
                    where: { id: req.dailyProductionLogId },
                    data: {
                        ...changes,
                        updatedBy: ctx.userId,
                        status: 'edited'
                    }
                });
                // Here we ideally recalculate (Original - New) diffs and apply them to `Mould` and `Assignment`.
                // TODO: Full transactional rollback and replay for calculations.
            }
            await audit_service_1.AuditService.write({
                tx,
                companyId: ctx.companyId,
                entityType: 'edit_request',
                entityId: req.id,
                action: data.status === 'approved' ? 'approve' : 'reject',
                actorUserId: ctx.userId,
                actorRole: ctx.role,
                before: req,
                after: updatedReq
            });
            await notification_service_1.NotificationService.enqueue(ctx.companyId, 'edit_request_decided', {
                editRequestId: req.id,
                vendorId: req.vendorId,
                status: data.status
            });
            return updatedReq;
        });
    }
};
