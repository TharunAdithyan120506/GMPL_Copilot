import { Router, Request, Response } from 'express';
import { EditRequestService } from './edit-request.service';
import { authenticate, authorize, scopeVendor } from '../../cross-cutting/auth/auth.middleware';
import { success, error } from '../../shared/response';

const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response) => {
  try {
    const data = await EditRequestService.list((req as any).auth, req.query);
    return success(res, data);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const data = await EditRequestService.create((req as any).auth, req.body);
    return success(res, data, 201);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

router.post('/:id/decide', async (req: Request, res: Response) => {
  try {
    const data = await EditRequestService.decide((req as any).auth, req.params.id as string, req.body);
    return success(res, data);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

export default router;
