import { Router, Request, Response } from 'express';
import { VendorService } from './vendor.service';
import { authenticate, authorize, scopeVendor } from '../../cross-cutting/auth/auth.middleware';
import { success, error } from '../../shared/response';

const router = Router();

router.use(authenticate);

// Vendors
router.get('/', authorize('vendor.view'), async (req: Request, res: Response) => {
  try {
    const data = await VendorService.listVendors((req as any).auth);
    return success(res, data);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

router.post('/', authorize('vendor.create'), async (req: Request, res: Response) => {
  try {
    const data = await VendorService.createVendor((req as any).auth, req.body);
    return success(res, data, 201);
  } catch (err: any) {
    if (err.code === 'P2002') err = { code: 'CONFLICT', message: 'Code already exists', status: 409 };
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

// Assignments
router.get('/assignments', authorize('assignment.view'), scopeVendor, async (req: Request, res: Response) => {
  try {
    const data = await VendorService.listAssignments((req as any).auth);
    return success(res, data);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

router.post('/assignments', authorize('assignment.create'), async (req: Request, res: Response) => {
  try {
    const data = await VendorService.assign((req as any).auth, req.body);
    return success(res, data, 201);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

router.post('/assignments/:id/revoke', authorize('assignment.revoke'), async (req: Request, res: Response) => {
  try {
    const data = await VendorService.revoke((req as any).auth, req.params.id as string);
    return success(res, data);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

export default router;
