import { Router, Request, Response } from 'express';
import { RepairService } from './repair-records.service';
import { authenticate, authorize } from '../../cross-cutting/auth/auth.middleware';
import { success, error } from '../../shared/response';

const router = Router();
router.use(authenticate);

router.get('/', authorize('repair.view'), async (req: Request, res: Response) => {
  try {
    const data = await RepairService.list((req as any).auth);
    return success(res, data);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

router.post('/', authorize('repair.create'), async (req: Request, res: Response) => {
  try {
    const data = await RepairService.create((req as any).auth, req.body);
    return success(res, data, 201);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

router.patch('/:id/status', authorize('repair.update'), async (req: Request, res: Response) => {
  try {
    const data = await RepairService.updateStatus((req as any).auth, req.params.id as string, req.body.status, req.body.reworkDescription);
    return success(res, data);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

export default router;
