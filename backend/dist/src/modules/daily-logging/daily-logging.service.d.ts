import { AuthContext } from '../../shared/types';
export declare const DailyLoggingService: {
    list(ctx: AuthContext, filter?: any): Promise<({
        mould: {
            name: string;
            code: string;
        };
        assignment: {
            rawMaterial: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                companyId: string;
                code: string;
                unit: string;
                deletedAt: Date | null;
                createdBy: string | null;
                updatedBy: string | null;
            };
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        companyId: string;
        deletedAt: Date | null;
        createdBy: string | null;
        updatedBy: string | null;
        version: number;
        vendorId: string;
        mouldId: string;
        status: string;
        rmConsumedQty: import("@prisma/client/runtime/library").Decimal;
        rmIrrecoverableLossQty: import("@prisma/client/runtime/library").Decimal;
        assignmentId: string;
        logDate: Date;
        shotsRun: bigint;
        acceptedQty: import("@prisma/client/runtime/library").Decimal;
        rejectedQty: import("@prisma/client/runtime/library").Decimal;
        dispatchedQty: import("@prisma/client/runtime/library").Decimal;
        downtimeReason: string | null;
        downtimeMinutes: number | null;
        shotWeightGSnapshot: import("@prisma/client/runtime/library").Decimal;
    })[]>;
    createDraft(ctx: AuthContext, data: any): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        companyId: string;
        deletedAt: Date | null;
        createdBy: string | null;
        updatedBy: string | null;
        version: number;
        vendorId: string;
        mouldId: string;
        status: string;
        rmConsumedQty: import("@prisma/client/runtime/library").Decimal;
        rmIrrecoverableLossQty: import("@prisma/client/runtime/library").Decimal;
        assignmentId: string;
        logDate: Date;
        shotsRun: bigint;
        acceptedQty: import("@prisma/client/runtime/library").Decimal;
        rejectedQty: import("@prisma/client/runtime/library").Decimal;
        dispatchedQty: import("@prisma/client/runtime/library").Decimal;
        downtimeReason: string | null;
        downtimeMinutes: number | null;
        shotWeightGSnapshot: import("@prisma/client/runtime/library").Decimal;
    }>;
    submit(ctx: AuthContext, id: string, idempotencyKey: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        companyId: string;
        deletedAt: Date | null;
        createdBy: string | null;
        updatedBy: string | null;
        version: number;
        vendorId: string;
        mouldId: string;
        status: string;
        rmConsumedQty: import("@prisma/client/runtime/library").Decimal;
        rmIrrecoverableLossQty: import("@prisma/client/runtime/library").Decimal;
        assignmentId: string;
        logDate: Date;
        shotsRun: bigint;
        acceptedQty: import("@prisma/client/runtime/library").Decimal;
        rejectedQty: import("@prisma/client/runtime/library").Decimal;
        dispatchedQty: import("@prisma/client/runtime/library").Decimal;
        downtimeReason: string | null;
        downtimeMinutes: number | null;
        shotWeightGSnapshot: import("@prisma/client/runtime/library").Decimal;
    }>;
};
//# sourceMappingURL=daily-logging.service.d.ts.map