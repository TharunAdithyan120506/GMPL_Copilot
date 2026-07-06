import { Router, Request, Response } from 'express';
import { AnalyticsService } from './analytics.service';
import { authenticate } from '../../cross-cutting/auth/auth.middleware';
import { success, error } from '../../shared/response';
import { AuthContext } from '../../shared/types';

const router = Router();
router.use(authenticate);

// Company-only guard for all analytics endpoints
router.use((req: Request, res: Response, next) => {
  const auth: AuthContext = (req as any).auth;
  if (auth?.role !== 'company') {
    return error(res, 'FORBIDDEN', 'Analytics is restricted to company admins', 403);
  }
  next();
});

router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const data = await AnalyticsService.getDashboardMetrics((req as any).auth);
    return success(res, data);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

router.get('/production', async (req: Request, res: Response) => {
  try {
    const data = await AnalyticsService.getProduction((req as any).auth);
    return success(res, data);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

router.get('/raw-material', async (req: Request, res: Response) => {
  try {
    const data = await AnalyticsService.getMaterials((req as any).auth);
    return success(res, data);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

router.get('/mould-life', async (req: Request, res: Response) => {
  try {
    const data = await AnalyticsService.getMouldLife((req as any).auth);
    return success(res, data);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

router.get('/downtime', async (req: Request, res: Response) => {
  try {
    const data = await AnalyticsService.getDowntime((req as any).auth);
    return success(res, data);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

export default router;
