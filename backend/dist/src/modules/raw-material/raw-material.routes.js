"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const raw_material_service_1 = require("./raw-material.service");
const auth_middleware_1 = require("../../cross-cutting/auth/auth.middleware");
const response_1 = require("../../shared/response");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/', (0, auth_middleware_1.authorize)('material.view'), async (req, res) => {
    try {
        const data = await raw_material_service_1.RawMaterialService.list(req.auth);
        return (0, response_1.success)(res, data);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
router.post('/', (0, auth_middleware_1.authorize)('material.create'), async (req, res) => {
    try {
        const data = await raw_material_service_1.RawMaterialService.create(req.auth, req.body);
        return (0, response_1.success)(res, data, 201);
    }
    catch (err) {
        if (err.code === 'P2002')
            err = { code: 'CONFLICT', message: 'Code already exists', status: 409 };
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
router.patch('/:id', (0, auth_middleware_1.authorize)('material.edit'), async (req, res) => {
    try {
        const data = await raw_material_service_1.RawMaterialService.update(req.auth, req.params.id, req.body);
        return (0, response_1.success)(res, data);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
router.delete('/:id', (0, auth_middleware_1.authorize)('material.delete'), async (req, res) => {
    try {
        await raw_material_service_1.RawMaterialService.delete(req.auth, req.params.id);
        return (0, response_1.success)(res, { deleted: true });
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
exports.default = router;
