"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const daily_logging_service_1 = require("./daily-logging.service");
const auth_middleware_1 = require("../../cross-cutting/auth/auth.middleware");
const response_1 = require("../../shared/response");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/', (0, auth_middleware_1.authorize)('log.view'), auth_middleware_1.scopeVendor, async (req, res) => {
    try {
        const data = await daily_logging_service_1.DailyLoggingService.list(req.auth, req.query);
        return (0, response_1.success)(res, data);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
router.post('/', (0, auth_middleware_1.authorize)('log.create'), auth_middleware_1.scopeVendor, async (req, res) => {
    try {
        const data = await daily_logging_service_1.DailyLoggingService.createDraft(req.auth, req.body);
        return (0, response_1.success)(res, data, 201);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
router.post('/:id/submit', (0, auth_middleware_1.authorize)('log.submit'), auth_middleware_1.scopeVendor, async (req, res) => {
    try {
        const idempotencyKey = req.headers['idempotency-key'];
        if (!idempotencyKey)
            return (0, response_1.error)(res, 'VALIDATION_ERROR', 'Idempotency-Key header is required', 400);
        const data = await daily_logging_service_1.DailyLoggingService.submit(req.auth, req.params.id, idempotencyKey);
        return (0, response_1.success)(res, data);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
exports.default = router;
