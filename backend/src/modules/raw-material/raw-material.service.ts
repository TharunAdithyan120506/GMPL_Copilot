import { prisma } from '../../shared/prisma';
import { AuthContext } from '../../shared/types';
import { Errors } from '../../shared/errors';
import { AuditService } from '../../cross-cutting/audit/audit.service';

export const RawMaterialService = {
  async list(ctx: AuthContext) {
    const materials = await prisma.rawMaterial.findMany({
      where: { companyId: ctx.companyId, deletedAt: null },
      orderBy: { name: 'asc' },
    });

    const balances = await prisma.assignment.groupBy({
      by: ['rawMaterialId'],
      where: { companyId: ctx.companyId, deletedAt: null },
      _sum: {
        rmAssignedQty: true,
        rmConsumedQty: true,
        rmIrrecoverableLossQty: true,
        rmRemainingQty: true,
      },
    });

    const balanceByMaterial = new Map(balances.map((b) => [b.rawMaterialId, b._sum]));
    return materials.map((material) => {
      const balance = balanceByMaterial.get(material.id);
      return {
        ...material,
        allocatedQty: Number(balance?.rmAssignedQty ?? 0),
        consumedQty: Number(balance?.rmConsumedQty ?? 0),
        lossQty: Number(balance?.rmIrrecoverableLossQty ?? 0),
        availableQty: Number(balance?.rmRemainingQty ?? 0),
      };
    });
  },

  async create(ctx: AuthContext, data: { code: string; name: string; unit: string }) {
    return prisma.$transaction(async (tx) => {
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
      await AuditService.write({
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

  async update(ctx: AuthContext, id: string, data: { name?: string; unit?: string }) {
    return prisma.$transaction(async (tx) => {
      const before = await tx.rawMaterial.findUnique({ where: { id } });
      if (!before || before.companyId !== ctx.companyId || before.deletedAt) {
        throw Errors.notFound('RawMaterial');
      }

      const rm = await tx.rawMaterial.update({
        where: { id },
        data: { ...data, updatedBy: ctx.userId },
      });

      await AuditService.write({
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

  async delete(ctx: AuthContext, id: string) {
    return prisma.$transaction(async (tx) => {
      const before = await tx.rawMaterial.findUnique({ where: { id } });
      if (!before || before.companyId !== ctx.companyId || before.deletedAt) {
        throw Errors.notFound('RawMaterial');
      }

      const rm = await tx.rawMaterial.update({
        where: { id },
        data: { deletedAt: new Date(), updatedBy: ctx.userId },
      });

      await AuditService.write({
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
