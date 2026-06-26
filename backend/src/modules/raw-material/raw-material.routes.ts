import { Router, Request, Response } from 'express';
import { RawMaterialService } from './raw-material.service';
import { authenticate, authorize } from '../../cross-cutting/auth/auth.middleware';
import { success, error } from '../../shared/response';

const router = Router();

router.use(authenticate);

router.get('/', authorize('material.view'), async (req: Request, res: Response) => {
  try {
    const data = await RawMaterialService.list((req as any).auth);
    return success(res, data);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

router.post('/', authorize('material.create'), async (req: Request, res: Response) => {
  try {
    const data = await RawMaterialService.create((req as any).auth, req.body);
    return success(res, data, 201);
  } catch (err: any) {
    if (err.code === 'P2002') err = { code: 'CONFLICT', message: 'Code already exists', status: 409 };
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

router.patch('/:id', authorize('material.edit'), async (req: Request, res: Response) => {
  try {
    const data = await RawMaterialService.update((req as any).auth, req.params.id as string, req.body);
    return success(res, data);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

router.delete('/:id', authorize('material.delete'), async (req: Request, res: Response) => {
  try {
    await RawMaterialService.delete((req as any).auth, req.params.id as string);
    return success(res, { deleted: true });
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

export default router;
