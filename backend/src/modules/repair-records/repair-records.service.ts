import { prisma } from '../../shared/prisma';
import { AuthContext } from '../../shared/types';
import { Errors } from '../../shared/errors';

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
    
    // Also update mould status to in_repair
    const [, repair] = await prisma.$transaction([
      prisma.mould.update({
        where: { id: data.mouldId },
        data: { lifecycleState: 'in_repair' }
      }),
      prisma.repairRecord.create({
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

  async updateStatus(ctx: AuthContext, id: string, status: string, reworkDescription?: string) {
    if (ctx.role !== 'company') throw Errors.forbidden('Only company can update repairs');
    
    const validStatuses = ['transit', 'repair', 'ready', 'scrapped'];
    if (!validStatuses.includes(status)) throw Errors.validation([{ field: 'status', issue: 'Invalid status' }]);

    const updateData: any = { status, updatedBy: ctx.userId };
    if (reworkDescription) updateData.reworkDescription = reworkDescription;
    
    if (status === 'scrapped' || status === 'ready') {
      updateData.closedAt = new Date();
    }

    const repair = await prisma.repairRecord.update({
      where: { id },
      data: updateData
    });

    // If ready, put mould back to active
    // If scrapped, put mould to retired
    if (status === 'ready') {
      await prisma.mould.update({ where: { id: repair.mouldId }, data: { lifecycleState: 'active' } });
    } else if (status === 'scrapped') {
      await prisma.mould.update({ where: { id: repair.mouldId }, data: { lifecycleState: 'retired' } });
    }

    return repair;
  }
};
