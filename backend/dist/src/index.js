"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * GMPL Copilot — Backend Entry Point
 *
 * IMPORTANT: dotenv.config() MUST be called before ANY other imports
 * that read process.env (Prisma, config modules, etc.)
 */
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config(); // ← Must be first — loads env before Prisma/other modules initialize
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const auth_routes_1 = __importDefault(require("./cross-cutting/auth/auth.routes"));
const raw_material_routes_1 = __importDefault(require("./modules/raw-material/raw-material.routes"));
const vendor_routes_1 = __importDefault(require("./modules/vendor-assignment/vendor.routes"));
const mould_routes_1 = __importDefault(require("./modules/mould/mould.routes"));
const daily_logging_routes_1 = __importDefault(require("./modules/daily-logging/daily-logging.routes"));
const edit_request_routes_1 = __importDefault(require("./modules/edit-request/edit-request.routes"));
const analytics_routes_1 = __importDefault(require("./modules/analytics/analytics.routes"));
const ai_copilot_routes_1 = __importDefault(require("./modules/ai-copilot/ai-copilot.routes"));
const repair_records_routes_1 = __importDefault(require("./modules/repair-records/repair-records.routes"));
const prisma_1 = require("./shared/prisma");
// [FIX: CODE-3] Use a replacer function instead of mutating BigInt.prototype
// This avoids silent data loss for BigInts > Number.MAX_SAFE_INTEGER
const originalJson = express_1.default.response.json;
express_1.default.response.json = function (body) {
    return originalJson.call(this, JSON.parse(JSON.stringify(body, (_, v) => typeof v === 'bigint' ? Number(v) : v)));
};
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// [FIX: SEC-1] Restrict CORS to the configured frontend origin only
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map(s => s.trim());
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, Postman during dev)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error(`CORS: Origin '${origin}' is not allowed`));
        }
    },
    credentials: true,
}));
app.use((0, helmet_1.default)());
app.use(express_1.default.json());
// [FIX: PROD-3] Rate limiting — protect all routes, extra strict on auth
const globalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // 500 requests per IP per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' } },
});
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Only 20 login attempts per IP per 15 min
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts, please try again in 15 minutes.' } },
});
app.use(globalLimiter);
// Cross-cutting health
app.get('/api/v1/health', async (req, res) => {
    try {
        await prisma_1.prisma.$queryRaw `SELECT 1`;
        res.status(200).json({ status: 'ok', db: 'connected' });
    }
    catch (err) {
        res.status(500).json({ status: 'error', db: 'disconnected' });
    }
});
// Module routes — auth routes get extra rate limiting
app.use('/api/v1/auth', authLimiter, auth_routes_1.default);
app.use('/api/v1/raw-materials', raw_material_routes_1.default);
app.use('/api/v1/vendors', vendor_routes_1.default);
app.use('/api/v1/moulds', mould_routes_1.default);
app.use('/api/v1/logs', daily_logging_routes_1.default);
app.use('/api/v1/edit-requests', edit_request_routes_1.default);
app.use('/api/v1/analytics', analytics_routes_1.default);
app.use('/api/v1/ai', ai_copilot_routes_1.default);
app.use('/api/v1/repairs', repair_records_routes_1.default);
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
app.use((err, req, res, next) => {
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
