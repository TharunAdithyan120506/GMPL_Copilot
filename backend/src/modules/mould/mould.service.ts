import { prisma } from '../../shared/prisma';
import { AuthContext, MouldLifecycleState } from '../../shared/types';
import { Errors } from '../../shared/errors';
import { AuditService } from '../../cross-cutting/audit/audit.service';

function activeAssignmentInclude(ctx: AuthContext) {
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
      orderBy: { assignedAt: 'desc' as const },
    },
  };
}

export const MouldService = {
  async list(ctx: AuthContext) {
    const where: any = { companyId: ctx.companyId, deletedAt: null };
    // Vendor can only see moulds on active assignments they own
    if (ctx.role === 'vendor') {
      where.assignments = { some: { vendorId: ctx.vendorId, status: 'active' } };
    }
    return prisma.mould.findMany({
      where,
      include: activeAssignmentInclude(ctx),
      orderBy: { name: 'asc' },
    });
  },

  async get(ctx: AuthContext, id: string) {
    const where: any = { id, companyId: ctx.companyId, deletedAt: null };
    if (ctx.role === 'vendor') {
      where.assignments = { some: { vendorId: ctx.vendorId, status: 'active' } };
    }
    const mould = await prisma.mould.findUnique({ where, include: activeAssignmentInclude(ctx) });
    if (!mould) throw Errors.notFound('Mould');
    return mould;
  },

  async create(ctx: AuthContext, data: any) {
    const shotWeightG = (data.runnerWeightG || 0) + ((data.partWeightG || 0) * (data.cavityCount || 1));
    return prisma.$transaction(async (tx) => {
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

      await AuditService.write({
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

  async transitionState(ctx: AuthContext, id: string, toState: MouldLifecycleState, eventType: string) {
    return prisma.$transaction(async (tx) => {
      const mould = await tx.mould.findUnique({ where: { id, companyId: ctx.companyId } });
      if (!mould || mould.deletedAt) throw Errors.notFound('Mould');

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

      await AuditService.write({
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
