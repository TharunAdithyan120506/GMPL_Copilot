import { Router, Request, Response } from 'express';
import { AiCopilotService } from './ai-copilot.service';
import { authenticate } from '../../cross-cutting/auth/auth.middleware';
import { success, error } from '../../shared/response';

const router = Router();
router.use(authenticate);

router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const data = await AiCopilotService.getConversations((req as any).auth);
    return success(res, data);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

router.post('/conversations', async (req: Request, res: Response) => {
  try {
    const data = await AiCopilotService.startConversation((req as any).auth);
    return success(res, data, 201);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

router.get('/conversations/:id', async (req: Request, res: Response) => {
  try {
    const data = await AiCopilotService.getMessages((req as any).auth, req.params.id as string);
    return success(res, data);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

router.post('/conversations/:id/messages', async (req: Request, res: Response) => {
  try {
    if (!req.body.content) throw { code: 'VALIDATION_ERROR', message: 'content is required', status: 400 };
    const data = await AiCopilotService.sendMessage((req as any).auth, req.params.id as string, req.body.content);
    return success(res, data, 201);
  } catch (err: any) {
    return error(res, err.code || 'INTERNAL', err.message, err.status || 500);
  }
});

export default router;
