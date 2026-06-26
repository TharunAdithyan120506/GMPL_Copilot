import { Router, Request, Response } from 'express';
import { DailyLoggingService } from './daily-logging.service';
import { authenticate, authorize, scopeVendor } from '../../cross-cutting/auth/auth.middleware';
import { success, error } from '../../shared/response';

const router = Router();
router.use(authenticate);

router.get('/', authorize('log.view'), scopeVendor, async (req: Request, res: Response) => {
  try {
    const data = await DailyLoggingService.list((req as any).auth, req.query);
    return success(res, data);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

router.post('/', authorize('log.create'), scopeVendor, async (req: Request, res: Response) => {
  try {
    const data = await DailyLoggingService.createDraft((req as any).auth, req.body);
    return success(res, data, 201);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

router.post('/:id/submit', authorize('log.submit'), scopeVendor, async (req: Request, res: Response) => {
  try {
    const idempotencyKey = req.headers['idempotency-key'] as string;
    if (!idempotencyKey) return error(res, 'VALIDATION_ERROR', 'Idempotency-Key header is required', 400);
    
    const data = await DailyLoggingService.submit((req as any).auth, req.params.id as string, idempotencyKey);
    return success(res, data);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

export default router;
