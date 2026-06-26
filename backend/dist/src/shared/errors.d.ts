export declare class AppError extends Error {
    readonly code: string;
    readonly status: number;
    readonly details?: {
        field: string;
        issue: string;
    }[] | undefined;
    constructor(code: string, message: string, status: number, details?: {
        field: string;
        issue: string;
    }[] | undefined);
}
export declare const Errors: {
    unauthorized: () => AppError;
    forbidden: (msg?: string) => AppError;
    notFound: (entity?: string) => AppError;
    conflict: (msg: string) => AppError;
    validation: (details: {
        field: string;
        issue: string;
    }[]) => AppError;
    stateTransition: (msg: string) => AppError;
    rateLimited: () => AppError;
    aiUnavailable: () => AppError;
    internal: (msg?: string) => AppError;
};
//# sourceMappingURL=errors.d.ts.map