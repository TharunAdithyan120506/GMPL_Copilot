import { AuthContext } from '../../shared/types';
export declare const RawMaterialService: {
    list(ctx: AuthContext): Promise<{
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
    }[]>;
    create(ctx: AuthContext, data: {
        code: string;
        name: string;
        unit: string;
    }): Promise<{
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
    }>;
    update(ctx: AuthContext, id: string, data: {
        name?: string;
        unit?: string;
    }): Promise<{
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
    }>;
    delete(ctx: AuthContext, id: string): Promise<void>;
};
//# sourceMappingURL=raw-material.service.d.ts.map