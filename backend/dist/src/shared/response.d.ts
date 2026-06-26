import { Response } from 'express';
export declare function success<T>(res: Response, data: T, status?: number, pagination?: any): Response<any, Record<string, any>>;
export declare function error(res: Response, code: string, message: string, status: number, details?: any, requestId?: string): Response<any, Record<string, any>>;
//# sourceMappingURL=response.d.ts.map