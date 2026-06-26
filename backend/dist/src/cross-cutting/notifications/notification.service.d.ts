export declare const NotificationService: {
    enqueue(companyId: string, type: string, payload: object): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        companyId: string;
        status: string;
        type: string;
        payload: import("@prisma/client/runtime/library").JsonValue;
    }>;
    dispatch(): Promise<void>;
};
//# sourceMappingURL=notification.service.d.ts.map