interface AuditInput {
    companyId: string;
    entityType: string;
    entityId: string;
    action: 'create' | 'update' | 'delete' | 'state_transition' | 'approve' | 'reject' | 'revoke';
    actorUserId?: string;
    actorRole: string;
    before?: object | null;
    after?: object | null;
    tx?: any;
}
export declare const AuditService: {
    /**
     * Write an audit record.
     * Pass `tx` (the Prisma transaction client) to write in the SAME transaction
     * as the business mutation. If omitted, writes in its own transaction.
     */
    write(input: AuditInput): Promise<any>;
};
export {};
//# sourceMappingURL=audit.service.d.ts.map