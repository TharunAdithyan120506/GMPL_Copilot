import { prisma } from '../../shared/prisma';
import { AuthContext } from '../../shared/types';

interface AuditInput {
  companyId: string;
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'state_transition' | 'approve' | 'reject' | 'revoke';
  actorUserId?: string;
  actorRole: string;
  before?: object | null;
  after?: object | null;
  tx?: any; // Prisma transaction client
}

export const AuditService = {
  /**
   * Write an audit record.
   * Pass `tx` (the Prisma transaction client) to write in the SAME transaction
   * as the business mutation. If omitted, writes in its own transaction.
   */
  async write(input: AuditInput) {
    const client = input.tx ?? prisma;
    return client.auditLog.create({
      data: {
        companyId: input.companyId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        actorUserId: input.actorUserId ?? null,
        actorRole: input.actorRole,
        before: input.before ?? undefined,
        after: input.after ?? undefined,
      },
    });
  },
};
