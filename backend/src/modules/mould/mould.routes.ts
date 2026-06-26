import { Router, Request, Response } from 'express';
import { MouldService } from './mould.service';
import { authenticate, authorize, scopeVendor } from '../../cross-cutting/auth/auth.middleware';
import { success, error } from '../../shared/response';

const router = Router();
router.use(authenticate);

router.get('/', authorize('mould.view'), scopeVendor, async (req: Request, res: Response) => {
  try {
    const data = await MouldService.list((req as any).auth);
    return success(res, data);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

router.get('/:id', authorize('mould.view'), scopeVendor, async (req: Request, res: Response) => {
  try {
    const data = await MouldService.get((req as any).auth, req.params.id as string);
    return success(res, data);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

router.post('/', authorize('mould.create'), async (req: Request, res: Response) => {
  try {
    const data = await MouldService.create((req as any).auth, req.body);
    return success(res, data, 201);
  } catch (err: any) {
    if (err.code === 'P2002') err = { code: 'CONFLICT', message: 'Code already exists', status: 409 };
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

router.post('/:id/move-to-repair', authorize('mould.lifecycle.transition'), async (req: Request, res: Response) => {
  try {
    const data = await MouldService.transitionState((req as any).auth, req.params.id as string, 'in_repair', 'moved_to_repair');
    return success(res, data);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

router.post('/:id/return-to-rotation', authorize('mould.lifecycle.transition'), async (req: Request, res: Response) => {
  try {
    const data = await MouldService.transitionState((req as any).auth, req.params.id as string, 'active', 'returned_to_rotation');
    return success(res, data);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

router.post('/:id/retire', authorize('mould.lifecycle.transition'), async (req: Request, res: Response) => {
  try {
    const data = await MouldService.transitionState((req as any).auth, req.params.id as string, 'retired', 'retired');
    return success(res, data);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

export default router;
