import { Router, Request, Response } from 'express';
import { AuthService } from './auth.service';
import { authenticate } from './auth.middleware';
import { success, error } from '../../shared/response';
import { AuthContext } from '../../shared/types';

const router = Router();

// POST /api/v1/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { loginIdentifier, password } = req.body;
    if (!loginIdentifier || !password) {
      return error(res, 'VALIDATION_ERROR', 'loginIdentifier and password required', 422);
    }
    const result = await AuthService.login(loginIdentifier, password);
    return success(res, result);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

// POST /api/v1/auth/logout
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization!.slice(7);
    await AuthService.logout(token);
    return success(res, { message: 'Logged out' });
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

// GET /api/v1/auth/me
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const auth = (req as any).auth as AuthContext;
    const me = await AuthService.me(auth.userId);
    return success(res, me);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

export default router;
