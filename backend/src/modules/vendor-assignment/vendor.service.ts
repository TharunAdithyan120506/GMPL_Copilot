import { prisma } from '../../shared/prisma';
import { AuthContext } from '../../shared/types';
import { Errors } from '../../shared/errors';
import { AuditService } from '../../cross-cutting/audit/audit.service';

export const VendorService = {
  async listVendors(ctx: AuthContext) {
    return prisma.vendor.findMany({
      where: { companyId: ctx.companyId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  },

  async createVendor(ctx: AuthContext, data: { code: string; name: string; isInternal?: boolean }) {
    return prisma.$transaction(async (tx) => {
      const vendor = await tx.vendor.create({
        data: {
          companyId: ctx.companyId,
          code: data.code,
          name: data.name,
          isInternal: data.isInternal || false,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      });
      await AuditService.write({
        companyId: ctx.companyId,
        entityType: 'vendor',
        entityId: vendor.id,
        action: 'create',
        actorUserId: ctx.userId,
        actorRole: ctx.role,
        after: vendor,
        tx,
      });
      return vendor;
    });
  },

  async listAssignments(ctx: AuthContext) {
    const where: any = { companyId: ctx.companyId, deletedAt: null };
    // Vendor scope isolation (Decision #1)
    if (ctx.role === 'vendor') {
      where.vendorId = ctx.vendorId;
    }
    return prisma.assignment.findMany({
      where,
      include: {
        mould: true,
        rawMaterial: true,
      },
      orderBy: { assignedAt: 'desc' },
    });
  },

  async assign(ctx: AuthContext, data: { vendorId: string; mouldId: string; rawMaterialId: string; rmAssignedQty: number }) {
    return prisma.$transaction(async (tx) => {
      try {
        const assignment = await tx.assignment.create({
          data: {
            companyId: ctx.companyId,
            vendorId: data.vendorId,
            mouldId: data.mouldId,
            rawMaterialId: data.rawMaterialId,
            rmAssignedQty: data.rmAssignedQty,
            rmRemainingQty: data.rmAssignedQty,
            status: 'active',
            assignedAt: new Date(),
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          },
        });
        
        await AuditService.write({
          companyId: ctx.companyId,
          entityType: 'assignment',
          entityId: assignment.id,
          action: 'create',
          actorUserId: ctx.userId,
          actorRole: ctx.role,
          after: assignment,
          tx,
        });
        return assignment;
      } catch (err: any) {
        // P2002 on partial unique index -> single active assignment violated
        if (err.code === 'P2002') throw Errors.conflict('Mould is already actively assigned to a vendor');
        throw err;
      }
    });
  },

  async revoke(ctx: AuthContext, id: string) {
    return prisma.$transaction(async (tx) => {
      const before = await tx.assignment.findUnique({ where: { id, companyId: ctx.companyId } });
      if (!before || before.status !== 'active') throw Errors.stateTransition('Assignment is not active');

      const assignment = await tx.assignment.update({
        where: { id },
        data: {
          status: 'revoked',
          revokedAt: new Date(),
          version: { increment: 1 },
          updatedBy: ctx.userId,
        },
      });

      await AuditService.write({
        companyId: ctx.companyId,
        entityType: 'assignment',
        entityId: id,
        action: 'revoke',
        actorUserId: ctx.userId,
        actorRole: ctx.role,
        before,
        after: assignment,
        tx,
      });
      return assignment;
    });
  }
};
