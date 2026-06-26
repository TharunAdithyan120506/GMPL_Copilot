"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const prisma_1 = require("../../shared/prisma");
exports.AuditService = {
    /**
     * Write an audit record.
     * Pass `tx` (the Prisma transaction client) to write in the SAME transaction
     * as the business mutation. If omitted, writes in its own transaction.
     */
    async write(input) {
        const client = input.tx ?? prisma_1.prisma;
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
