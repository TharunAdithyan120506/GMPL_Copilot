"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const repair_records_service_1 = require("./repair-records.service");
const auth_middleware_1 = require("../../cross-cutting/auth/auth.middleware");
const response_1 = require("../../shared/response");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/', async (req, res) => {
    try {
        const data = await repair_records_service_1.RepairService.list(req.auth);
        return (0, response_1.success)(res, data);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
router.post('/', async (req, res) => {
    try {
        const data = await repair_records_service_1.RepairService.create(req.auth, req.body);
        return (0, response_1.success)(res, data, 201);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
router.patch('/:id/status', async (req, res) => {
    try {
        const data = await repair_records_service_1.RepairService.updateStatus(req.auth, req.params.id, req.body.status, req.body.reworkDescription);
        return (0, response_1.success)(res, data);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
exports.default = router;
