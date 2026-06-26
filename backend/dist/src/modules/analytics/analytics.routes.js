"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const analytics_service_1 = require("./analytics.service");
const auth_middleware_1 = require("../../cross-cutting/auth/auth.middleware");
const response_1 = require("../../shared/response");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/dashboard', async (req, res) => {
    try {
        const data = await analytics_service_1.AnalyticsService.getDashboardMetrics(req.auth);
        return (0, response_1.success)(res, data);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
router.get('/production', async (req, res) => {
    try {
        const data = await analytics_service_1.AnalyticsService.getProduction(req.auth);
        return (0, response_1.success)(res, data);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
router.get('/raw-material', async (req, res) => {
    try {
        const data = await analytics_service_1.AnalyticsService.getMaterials(req.auth);
        return (0, response_1.success)(res, data);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
router.get('/mould-life', async (req, res) => {
    try {
        const data = await analytics_service_1.AnalyticsService.getMouldLife(req.auth);
        return (0, response_1.success)(res, data);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
router.get('/downtime', async (req, res) => {
    try {
        const data = await analytics_service_1.AnalyticsService.getDowntime(req.auth);
        return (0, response_1.success)(res, data);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
exports.default = router;
