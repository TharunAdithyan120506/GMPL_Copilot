import { prisma } from '../../shared/prisma';
import { AuthContext } from '../../shared/types';
import { Errors } from '../../shared/errors';
import { AuditService } from '../../cross-cutting/audit/audit.service';

export const RepairService = {
  async list(ctx: AuthContext) {
    if (ctx.role !== 'company') throw Errors.forbidden('Only company can view all repairs');
    return prisma.repairRecord.findMany({
      where: { companyId: ctx.companyId, deletedAt: null },
      include: {
        mould: { select: { code: true, name: true } },
        reporter: { select: { id: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  },

  async create(ctx: AuthContext, data: { mouldId: string; issueDescription: string }) {
    if (ctx.role !== 'company') throw Errors.forbidden('Only company can create repairs');
    
    return prisma.$transaction(async (tx) => {
      const mould = await tx.mould.findFirst({
        where: { id: data.mouldId, companyId: ctx.companyId, deletedAt: null },
      });
      if (!mould) throw Errors.notFound('Mould');

      await tx.mould.update({
        where: { id: mould.id },
        data: { lifecycleState: 'in_repair', updatedBy: ctx.userId },
      });

      await tx.mouldLifecycleEvent.create({
        data: {
          companyId: ctx.companyId,
          mouldId: mould.id,
          eventType: 'moved_to_repair',
          fromState: mould.lifecycleState,
          toState: 'in_repair',
          shotCountAtEvent: mould.shotCountAccumulated,
          triggeredBy: ctx.userId,
          triggerKind: 'manual',
          createdBy: ctx.userId,
        },
      });

      const repair = await tx.repairRecord.create({
        data: {
          companyId: ctx.companyId,
          mouldId: mould.id,
          reportedBy: ctx.userId,
          status: 'transit',
          issueDescription: data.issueDescription,
          openedAt: new Date(),
          createdBy: ctx.userId,
          updatedBy: ctx.userId
        }
      });

      await AuditService.write({
        tx,
        companyId: ctx.companyId,
        entityType: 'repair_record',
        entityId: repair.id,
        action: 'create',
        actorUserId: ctx.userId,
        actorRole: ctx.role,
        after: repair,
      });

      return repair;
    });
  },

  async updateStatus(ctx: AuthContext, id: string, status: string, reworkDescription?: string) {
    if (ctx.role !== 'company') throw Errors.forbidden('Only company can update repairs');
    
    const validStatuses = ['transit', 'repair', 'ready', 'scrapped'];
    if (!validStatuses.includes(status)) throw Errors.validation([{ field: 'status', issue: 'Invalid status' }]);

    const updateData: any = { status, updatedBy: ctx.userId };
    if (reworkDescription) updateData.reworkDescription = reworkDescription;
    
    if (status === 'scrapped' || status === 'ready') {
      updateData.closedAt = new Date();
    } else {
      updateData.closedAt = null;
    }

    return prisma.$transaction(async (tx) => {
      const before = await tx.repairRecord.findFirst({
        where: { id, companyId: ctx.companyId, deletedAt: null },
      });
      if (!before) throw Errors.notFound('Repair record');

      const repair = await tx.repairRecord.update({
        where: { id },
        data: updateData
      });

      if (['repair', 'transit', 'ready', 'scrapped'].includes(status)) {
        const toState = status === 'ready' ? 'active' : status === 'scrapped' ? 'retired' : 'in_repair';
        const mould = await tx.mould.findFirst({
          where: { id: repair.mouldId, companyId: ctx.companyId },
        });
        if (!mould) throw Errors.notFound('Mould');

        await tx.mould.update({ where: { id: repair.mouldId }, data: { lifecycleState: toState, updatedBy: ctx.userId } });
        await tx.mouldLifecycleEvent.create({
          data: {
            companyId: ctx.companyId,
            mouldId: repair.mouldId,
            eventType: status === 'ready' ? 'returned_to_rotation' : status === 'scrapped' ? 'retired' : 'moved_to_repair',
            fromState: mould.lifecycleState,
            toState,
            shotCountAtEvent: mould.shotCountAccumulated,
            triggeredBy: ctx.userId,
            triggerKind: 'manual',
            createdBy: ctx.userId,
          },
        });
      }

      await AuditService.write({
        tx,
        companyId: ctx.companyId,
        entityType: 'repair_record',
        entityId: repair.id,
        action: 'state_transition',
        actorUserId: ctx.userId,
        actorRole: ctx.role,
        before,
        after: repair,
      });

      return repair;
    });
  }
};
