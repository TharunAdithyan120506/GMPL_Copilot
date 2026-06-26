"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RawMaterialService = void 0;
const prisma_1 = require("../../shared/prisma");
const errors_1 = require("../../shared/errors");
const audit_service_1 = require("../../cross-cutting/audit/audit.service");
exports.RawMaterialService = {
    async list(ctx) {
        return prisma_1.prisma.rawMaterial.findMany({
            where: { companyId: ctx.companyId, deletedAt: null },
            orderBy: { name: 'asc' },
        });
    },
    async create(ctx, data) {
        return prisma_1.prisma.$transaction(async (tx) => {
            const rm = await tx.rawMaterial.create({
                data: {
                    companyId: ctx.companyId,
                    code: data.code,
                    name: data.name,
                    unit: data.unit,
                    createdBy: ctx.userId,
                    updatedBy: ctx.userId,
                },
            });
            await audit_service_1.AuditService.write({
                companyId: ctx.companyId,
                entityType: 'raw_material',
                entityId: rm.id,
                action: 'create',
                actorUserId: ctx.userId,
                actorRole: ctx.role,
                after: rm,
                tx,
            });
            return rm;
        });
    },
    async update(ctx, id, data) {
        return prisma_1.prisma.$transaction(async (tx) => {
            const before = await tx.rawMaterial.findUnique({ where: { id } });
            if (!before || before.companyId !== ctx.companyId || before.deletedAt) {
                throw errors_1.Errors.notFound('RawMaterial');
            }
            const rm = await tx.rawMaterial.update({
                where: { id },
                data: { ...data, updatedBy: ctx.userId },
            });
            await audit_service_1.AuditService.write({
                companyId: ctx.companyId,
                entityType: 'raw_material',
                entityId: rm.id,
                action: 'update',
                actorUserId: ctx.userId,
                actorRole: ctx.role,
                before,
                after: rm,
                tx,
            });
            return rm;
        });
    },
    async delete(ctx, id) {
        return prisma_1.prisma.$transaction(async (tx) => {
            const before = await tx.rawMaterial.findUnique({ where: { id } });
            if (!before || before.companyId !== ctx.companyId || before.deletedAt) {
                throw errors_1.Errors.notFound('RawMaterial');
            }
            const rm = await tx.rawMaterial.update({
                where: { id },
                data: { deletedAt: new Date(), updatedBy: ctx.userId },
            });
            await audit_service_1.AuditService.write({
                companyId: ctx.companyId,
                entityType: 'raw_material',
                entityId: rm.id,
                action: 'delete',
                actorUserId: ctx.userId,
                actorRole: ctx.role,
                before,
                tx,
            });
        });
    }
};
