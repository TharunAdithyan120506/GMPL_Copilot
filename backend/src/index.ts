/**
 * GMPL Copilot — Backend Entry Point
 *
 * IMPORTANT: dotenv.config() MUST be called before ANY other imports
 * that read process.env (Prisma, config modules, etc.)
 */
import dotenv from 'dotenv';
dotenv.config(); // ← Must be first — loads env before Prisma/other modules initialize

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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

// [FIX: CODE-3] Use a replacer function instead of mutating BigInt.prototype
// This avoids silent data loss for BigInts > Number.MAX_SAFE_INTEGER
const originalJson = express.response.json;
express.response.json = function (body: any) {
  return originalJson.call(this, JSON.parse(JSON.stringify(body, (_, v) =>
    typeof v === 'bigint' ? Number(v) : v
  )));
};

const app = express();
const PORT = process.env.PORT || 3000;

// [FIX: SEC-1] Restrict CORS to the configured frontend origin only
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman during dev)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin '${origin}' is not allowed`));
    }
  },
  credentials: true,
}));

app.use(helmet());
app.use(express.json());

// [FIX: PROD-3] Rate limiting — protect all routes, extra strict on auth
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,                  // 500 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' } },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // Only 20 login attempts per IP per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts, please try again in 15 minutes.' } },
});

app.use(globalLimiter);

// Cross-cutting health
app.get('/api/v1/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

// Module routes — auth routes get extra rate limiting
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/raw-materials', rawMaterialRoutes);
app.use('/api/v1/vendors', vendorRoutes);
app.use('/api/v1/moulds', mouldRoutes);
app.use('/api/v1/logs', logRoutes);
app.use('/api/v1/edit-requests', editRequestRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/ai', aiCopilotRoutes);
app.use('/api/v1/repairs', repairRoutes);

// [FIX: PROD-4] Global 404 handler — returns JSON instead of Express's default HTML
app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested endpoint does not exist.',
    },
  });
});

// Global error handler
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
