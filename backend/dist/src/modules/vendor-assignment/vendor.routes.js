"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const vendor_service_1 = require("./vendor.service");
const auth_middleware_1 = require("../../cross-cutting/auth/auth.middleware");
const response_1 = require("../../shared/response");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// Vendors
router.get('/', (0, auth_middleware_1.authorize)('vendor.view'), async (req, res) => {
    try {
        const data = await vendor_service_1.VendorService.listVendors(req.auth);
        return (0, response_1.success)(res, data);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
router.post('/', (0, auth_middleware_1.authorize)('vendor.create'), async (req, res) => {
    try {
        const data = await vendor_service_1.VendorService.createVendor(req.auth, req.body);
        return (0, response_1.success)(res, data, 201);
    }
    catch (err) {
        if (err.code === 'P2002')
            err = { code: 'CONFLICT', message: 'Code already exists', status: 409 };
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
// Assignments
router.get('/assignments', (0, auth_middleware_1.authorize)('assignment.view'), auth_middleware_1.scopeVendor, async (req, res) => {
    try {
        const data = await vendor_service_1.VendorService.listAssignments(req.auth);
        return (0, response_1.success)(res, data);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
router.post('/assignments', (0, auth_middleware_1.authorize)('assignment.create'), async (req, res) => {
    try {
        const data = await vendor_service_1.VendorService.assign(req.auth, req.body);
        return (0, response_1.success)(res, data, 201);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
router.post('/assignments/:id/revoke', (0, auth_middleware_1.authorize)('assignment.revoke'), async (req, res) => {
    try {
        const data = await vendor_service_1.VendorService.revoke(req.auth, req.params.id);
        return (0, response_1.success)(res, data);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
exports.default = router;
