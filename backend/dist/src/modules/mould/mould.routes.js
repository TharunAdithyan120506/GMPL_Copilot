"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mould_service_1 = require("./mould.service");
const auth_middleware_1 = require("../../cross-cutting/auth/auth.middleware");
const response_1 = require("../../shared/response");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/', (0, auth_middleware_1.authorize)('mould.view'), auth_middleware_1.scopeVendor, async (req, res) => {
    try {
        const data = await mould_service_1.MouldService.list(req.auth);
        return (0, response_1.success)(res, data);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
router.get('/:id', (0, auth_middleware_1.authorize)('mould.view'), auth_middleware_1.scopeVendor, async (req, res) => {
    try {
        const data = await mould_service_1.MouldService.get(req.auth, req.params.id);
        return (0, response_1.success)(res, data);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
router.post('/', (0, auth_middleware_1.authorize)('mould.create'), async (req, res) => {
    try {
        const data = await mould_service_1.MouldService.create(req.auth, req.body);
        return (0, response_1.success)(res, data, 201);
    }
    catch (err) {
        if (err.code === 'P2002')
            err = { code: 'CONFLICT', message: 'Code already exists', status: 409 };
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
router.post('/:id/move-to-repair', (0, auth_middleware_1.authorize)('mould.lifecycle.transition'), async (req, res) => {
    try {
        const data = await mould_service_1.MouldService.transitionState(req.auth, req.params.id, 'in_repair', 'moved_to_repair');
        return (0, response_1.success)(res, data);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
router.post('/:id/return-to-rotation', (0, auth_middleware_1.authorize)('mould.lifecycle.transition'), async (req, res) => {
    try {
        const data = await mould_service_1.MouldService.transitionState(req.auth, req.params.id, 'active', 'returned_to_rotation');
        return (0, response_1.success)(res, data);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
router.post('/:id/retire', (0, auth_middleware_1.authorize)('mould.lifecycle.transition'), async (req, res) => {
    try {
        const data = await mould_service_1.MouldService.transitionState(req.auth, req.params.id, 'retired', 'retired');
        return (0, response_1.success)(res, data);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
exports.default = router;
