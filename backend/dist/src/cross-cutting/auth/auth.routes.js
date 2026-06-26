"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_service_1 = require("./auth.service");
const auth_middleware_1 = require("./auth.middleware");
const response_1 = require("../../shared/response");
const router = (0, express_1.Router)();
// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
    try {
        const { loginIdentifier, password } = req.body;
        if (!loginIdentifier || !password) {
            return (0, response_1.error)(res, 'VALIDATION_ERROR', 'loginIdentifier and password required', 422);
        }
        const result = await auth_service_1.AuthService.login(loginIdentifier, password);
        return (0, response_1.success)(res, result);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
// POST /api/v1/auth/logout
router.post('/logout', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const token = req.headers.authorization.slice(7);
        await auth_service_1.AuthService.logout(token);
        return (0, response_1.success)(res, { message: 'Logged out' });
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
// GET /api/v1/auth/me
router.get('/me', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const auth = req.auth;
        const me = await auth_service_1.AuthService.me(auth.userId);
        return (0, response_1.success)(res, me);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
exports.default = router;
