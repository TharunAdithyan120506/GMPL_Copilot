import { prisma } from '../../shared/prisma';
import { AuthContext } from '../../shared/types';
import { Errors } from '../../shared/errors';
import { AuditService } from '../../cross-cutting/audit/audit.service';
import bcrypt from 'bcryptjs';

export const VendorService = {
  async listVendors(ctx: AuthContext) {
    const vendors = await prisma.vendor.findMany({
      where: { companyId: ctx.companyId, deletedAt: null },
      include: { users: { where: { deletedAt: null }, select: { loginIdentifier: true }, take: 1 } },
      orderBy: { name: 'asc' },
    });
    return vendors.map((vendor) => ({
      ...vendor,
      sharedLoginId: vendor.users[0]?.loginIdentifier ?? null,
      users: undefined,
    }));
  },

  async createVendor(ctx: AuthContext, data: { code: string; name: string; isInternal?: boolean; sharedLoginId?: string; initialPassword?: string }) {
    return prisma.$transaction(async (tx) => {
      if (!data.code?.trim() || !data.name?.trim()) {
        throw Errors.validation([
          { field: 'code', issue: 'Required' },
          { field: 'name', issue: 'Required' },
        ]);
      }

      const vendor = await tx.vendor.create({
        data: {
          companyId: ctx.companyId,
          code: data.code.trim(),
          name: data.name.trim(),
          isInternal: data.isInternal || false,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      });

      if (data.sharedLoginId?.trim()) {
        const vendorRole = await tx.role.findFirst({ where: { companyId: ctx.companyId, key: 'vendor' } });
        if (!vendorRole) throw Errors.internal('Vendor role is not configured');

        await tx.user.create({
          data: {
            companyId: ctx.companyId,
            roleId: vendorRole.id,
            vendorId: vendor.id,
            loginIdentifier: data.sharedLoginId.trim(),
            passwordHash: await bcrypt.hash(data.initialPassword || 'password', 10),
            isActive: true,
          },
        });
      }

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
        vendor: { select: { id: true, code: true, name: true } },
        mould: true,
        rawMaterial: true,
      },
      orderBy: { assignedAt: 'desc' },
    });
  },

  async assign(ctx: AuthContext, data: { vendorId: string; mouldId: string; rawMaterialId: string; rmAssignedQty: number }) {
    return prisma.$transaction(async (tx) => {
      try {
        if (!Number.isFinite(Number(data.rmAssignedQty)) || Number(data.rmAssignedQty) <= 0) {
          throw Errors.validation([{ field: 'rmAssignedQty', issue: 'Must be greater than zero' }]);
        }

        const [vendor, mould, rawMaterial] = await Promise.all([
          tx.vendor.findFirst({ where: { id: data.vendorId, companyId: ctx.companyId, isActive: true, deletedAt: null } }),
          tx.mould.findFirst({ where: { id: data.mouldId, companyId: ctx.companyId, deletedAt: null } }),
          tx.rawMaterial.findFirst({ where: { id: data.rawMaterialId, companyId: ctx.companyId, deletedAt: null } }),
        ]);
        if (!vendor) throw Errors.notFound('Vendor');
        if (!mould) throw Errors.notFound('Mould');
        if (!rawMaterial) throw Errors.notFound('Raw material');

        const existingActiveAssignment = await tx.assignment.findFirst({
          where: {
            companyId: ctx.companyId,
            mouldId: data.mouldId,
            status: 'active',
            deletedAt: null,
          },
          include: { vendor: { select: { code: true, name: true } } },
        });
        if (existingActiveAssignment) {
          throw Errors.conflict(
            `Mould is already actively assigned to ${existingActiveAssignment.vendor.name} (${existingActiveAssignment.vendor.code})`
          );
        }

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
