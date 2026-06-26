"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const edit_request_service_1 = require("./edit-request.service");
const auth_middleware_1 = require("../../cross-cutting/auth/auth.middleware");
const response_1 = require("../../shared/response");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/', (0, auth_middleware_1.authorize)('log.view'), auth_middleware_1.scopeVendor, async (req, res) => {
    try {
        const data = await edit_request_service_1.EditRequestService.list(req.auth, req.query);
        return (0, response_1.success)(res, data);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
router.post('/', (0, auth_middleware_1.authorize)('log.edit'), auth_middleware_1.scopeVendor, async (req, res) => {
    try {
        const data = await edit_request_service_1.EditRequestService.create(req.auth, req.body);
        return (0, response_1.success)(res, data, 201);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
router.post('/:id/decide', (0, auth_middleware_1.authorize)('log.approve_edit'), async (req, res) => {
    try {
        const data = await edit_request_service_1.EditRequestService.decide(req.auth, req.params.id, req.body);
        return (0, response_1.success)(res, data);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
exports.default = router;
