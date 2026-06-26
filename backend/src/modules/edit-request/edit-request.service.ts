import { prisma } from '../../shared/prisma';
import { AuthContext } from '../../shared/types';
import { Errors } from '../../shared/errors';
import { AuditService } from '../../cross-cutting/audit/audit.service';
import { NotificationService } from '../../cross-cutting/notifications/notification.service';

export const EditRequestService = {
  async list(ctx: AuthContext, filter: any = {}) {
    const where: any = { companyId: ctx.companyId };
    
    // Vendors only see their own edit requests
    if (ctx.role === 'vendor') {
      where.vendorId = ctx.vendorId;
    }
    
    if (filter.status) where.status = filter.status;

    return prisma.editRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        vendor: { select: { name: true, code: true } },
        dailyProductionLog: { select: { id: true, logDate: true, acceptedQty: true, rejectedQty: true } }
      }
    });
  },

  async create(ctx: AuthContext, data: any) {
    if (ctx.role !== 'vendor') throw Errors.forbidden('Only vendors can request edits');

    const log = await prisma.dailyProductionLog.findFirst({
      where: { id: data.dailyProductionLogId, companyId: ctx.companyId, vendorId: ctx.vendorId! }
    });

    if (!log) throw Errors.notFound('Production log not found');
    if (!['submitted', 'corrected'].includes(log.status)) {
      throw Errors.stateTransition('Can only edit submitted logs');
    }

    return prisma.$transaction(async (tx) => {
      const req = await tx.editRequest.create({
        data: {
          companyId: ctx.companyId,
          vendorId: ctx.vendorId!,
          dailyProductionLogId: log.id,
          requestedChanges: data.requestedChanges, // e.g. { acceptedQty: 500, rejectedQty: 10 }
          reason: data.reason,
          status: 'pending',
          createdBy: ctx.userId
        }
      });

      await AuditService.write({
        tx,
        companyId: ctx.companyId,
        entityType: 'edit_request',
        entityId: req.id,
        action: 'create',
        actorUserId: ctx.userId,
        actorRole: ctx.role,
        after: req
      });

      await NotificationService.enqueue(ctx.companyId, 'edit_request_created', {
        editRequestId: req.id,
        vendorId: ctx.vendorId,
        logId: log.id
      }, tx);

      return req;
    });
  },

  async decide(ctx: AuthContext, id: string, data: { status: 'approved' | 'rejected', decisionNote?: string }) {
    if (ctx.role !== 'company') {
      throw Errors.forbidden('Only company admins can decide on edit requests');
    }

    return prisma.$transaction(async (tx) => {
      const req = await tx.editRequest.findUnique({
        where: { id, companyId: ctx.companyId },
        include: { dailyProductionLog: true }
      });

      if (!req) throw Errors.notFound('Edit request not found');
      if (req.status !== 'pending') throw Errors.stateTransition('Request is already processed');

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

      if (data.status === 'approved') {
        const changes = req.requestedChanges as any;
        const nextAcceptedQty = Number(changes.acceptedQty ?? req.dailyProductionLog.acceptedQty);
        const nextRejectedQty = Number(changes.rejectedQty ?? req.dailyProductionLog.rejectedQty);
        const nextDispatchedQty = Number(changes.dispatchedQty ?? req.dailyProductionLog.dispatchedQty);
        validateQuantity('acceptedQty', nextAcceptedQty);
        validateQuantity('rejectedQty', nextRejectedQty);
        validateQuantity('dispatchedQty', nextDispatchedQty);

        const mould = await tx.mould.findFirst({
          where: { id: req.dailyProductionLog.mouldId, companyId: ctx.companyId, deletedAt: null },
        });
        if (!mould) throw Errors.notFound('Mould');

        const totalParts = nextAcceptedQty + nextRejectedQty;
        if (totalParts % mould.cavityCount !== 0) {
          throw Errors.validation([
            {
              field: 'requestedChanges',
              issue: `Accepted + rejected quantity (${totalParts}) must be divisible by cavity count (${mould.cavityCount})`,
            },
          ]);
        }

        const nextShotsRun = totalParts / mould.cavityCount;
        const shotWeightG = Number(req.dailyProductionLog.shotWeightGSnapshot || mould.shotWeightG);
        const nextRmConsumedQty = (nextShotsRun * shotWeightG) / 1000;
        const nextRmLossQty = nextRmConsumedQty * 0.01;

        const previousShotsRun = Number(req.dailyProductionLog.shotsRun);
        const previousRmConsumedQty = Number(req.dailyProductionLog.rmConsumedQty);
        const previousRmLossQty = Number(req.dailyProductionLog.rmIrrecoverableLossQty);
        const shotsDelta = nextShotsRun - previousShotsRun;
        const consumedDelta = nextRmConsumedQty - previousRmConsumedQty;
        const lossDelta = nextRmLossQty - previousRmLossQty;

        await tx.dailyProductionLog.update({
          where: { id: req.dailyProductionLogId },
          data: {
            acceptedQty: nextAcceptedQty,
            rejectedQty: nextRejectedQty,
            dispatchedQty: nextDispatchedQty,
            shotsRun: nextShotsRun,
            rmConsumedQty: nextRmConsumedQty,
            rmIrrecoverableLossQty: nextRmLossQty,
            updatedBy: ctx.userId,
            status: 'corrected'
          }
        });

        await tx.assignment.update({
          where: { id: req.dailyProductionLog.assignmentId },
          data: {
            rmConsumedQty: { increment: consumedDelta },
            rmIrrecoverableLossQty: { increment: lossDelta },
            rmRemainingQty: { decrement: consumedDelta + lossDelta },
            updatedBy: ctx.userId,
          },
        });

        await tx.mould.update({
          where: { id: req.dailyProductionLog.mouldId },
          data: {
            shotCountAccumulated: { increment: shotsDelta },
            updatedBy: ctx.userId,
          },
        });
      }

      await AuditService.write({
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

      await NotificationService.enqueue(ctx.companyId, 'edit_request_decided', {
        editRequestId: req.id,
        vendorId: req.vendorId,
        status: data.status
      }, tx);

      return updatedReq;
    });
  }
};

function validateQuantity(field: string, value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw Errors.validation([{ field, issue: 'Must be a non-negative number' }]);
  }
}
