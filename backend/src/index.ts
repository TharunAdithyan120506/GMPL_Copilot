import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './cross-cutting/auth/auth.routes';
import rawMaterialRoutes from './modules/raw-material/raw-material.routes';
import vendorRoutes from './modules/vendor-assignment/vendor.routes';
import mouldRoutes from './modules/mould/mould.routes';
import logRoutes from './modules/daily-logging/daily-logging.routes';
import editRequestRoutes from './modules/edit-request/edit-request.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import aiCopilotRoutes from './modules/ai-copilot/ai-copilot.routes';
import repairRoutes from './modules/repair-records/repair-records.routes';
import { prisma } from './shared/prisma';

(BigInt.prototype as any).toJSON = function () {
  return Number(this.toString());
};

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Cross-cutting health
app.get('/api/v1/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

// Module routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/raw-materials', rawMaterialRoutes);
app.use('/api/v1/vendors', vendorRoutes);
app.use('/api/v1/moulds', mouldRoutes);
app.use('/api/v1/logs', logRoutes);
app.use('/api/v1/edit-requests', editRequestRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/ai', aiCopilotRoutes);
app.use('/api/v1/repairs', repairRoutes);

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: {
      code: err.code || 'INTERNAL',
      message: err.message || 'Internal server error',
      details: err.details,
    }
  });
});

app.listen(PORT, () => {
  console.log(`GMPL Copilot Backend running on port ${PORT}`);
});
