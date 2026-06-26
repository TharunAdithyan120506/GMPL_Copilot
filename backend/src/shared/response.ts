import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function success<T>(res: Response, data: T, status = 200, pagination?: any) {
  return res.status(status).json({
    data,
    meta: { requestId: uuidv4(), ...(pagination ? { pagination } : {}) },
  });
}

export function error(res: Response, code: string, message: string, status: number, details?: any, requestId?: string) {
  return res.status(status).json({
    error: { code, message, ...(details ? { details } : {}), requestId: requestId || uuidv4() },
  });
}
