import { Request, Response, NextFunction } from 'express';
import { AuthContext } from '../shared/types';
export declare function signToken(payload: AuthContext, expiresIn?: string): any;
export declare function signRefreshToken(userId: string): any;
export declare function authenticate(req: Request, res: Response, next: NextFunction): any;
export declare function authorize(...permissions: string[]): (req: Request, res: Response, next: NextFunction) => any;
export declare function scopeVendor(req: Request, res: Response, next: NextFunction): any;
//# sourceMappingURL=auth.middleware.d.ts.map