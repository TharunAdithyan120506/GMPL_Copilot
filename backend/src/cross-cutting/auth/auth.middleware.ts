import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError, Errors } from '../../shared/errors';
import { AuthContext } from '../../shared/types';
import { error } from '../../shared/response';
import { prisma } from '../../shared/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

export function signToken(payload: AuthContext, expiresIn = '15m') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as any });
}

export function signRefreshToken(userId: string) {
  return jwt.sign({ sub: userId, type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' });
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return error(res, 'AUTH_REQUIRED', 'Authentication required', 401);
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthContext;
    (req as any).auth = payload;
    next();
  } catch {
    return error(res, 'AUTH_REQUIRED', 'Invalid or expired token', 401);
  }
}

export function authorize(...permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth: AuthContext = (req as any).auth;
    if (!auth) return error(res, 'AUTH_REQUIRED', 'Authentication required', 401);
    const hasAll = permissions.every(p => auth.permissions.includes(p));
    if (!hasAll) return error(res, 'FORBIDDEN', 'Insufficient permissions', 403);
    next();
  };
}

export function scopeVendor(req: Request, res: Response, next: NextFunction) {
  const auth: AuthContext = (req as any).auth;
  if (auth?.role === 'vendor' && !auth.vendorId) {
    return error(res, 'FORBIDDEN', 'Vendor identity not resolved', 403);
  }
  next();
}
