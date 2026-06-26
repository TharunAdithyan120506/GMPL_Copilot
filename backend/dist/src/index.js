"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
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
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
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
// Module routes
app.use('/api/v1/auth', auth_routes_1.default);
app.use('/api/v1/raw-materials', raw_material_routes_1.default);
app.use('/api/v1/vendors', vendor_routes_1.default);
app.use('/api/v1/moulds', mould_routes_1.default);
app.use('/api/v1/logs', daily_logging_routes_1.default);
app.use('/api/v1/edit-requests', edit_request_routes_1.default);
app.use('/api/v1/analytics', analytics_routes_1.default);
app.use('/api/v1/ai', ai_copilot_routes_1.default);
app.use('/api/v1/repairs', repair_records_routes_1.default);
// Error handler
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
