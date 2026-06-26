"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signToken = signToken;
exports.signRefreshToken = signRefreshToken;
exports.authenticate = authenticate;
exports.authorize = authorize;
exports.scopeVendor = scopeVendor;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = require("crypto");
const response_1 = require("../../shared/response");
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';
function signToken(payload, expiresIn = '15m') {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: expiresIn });
}
function signRefreshToken(userId) {
    return jsonwebtoken_1.default.sign({ sub: userId, type: 'refresh', jti: (0, crypto_1.randomUUID)() }, JWT_SECRET, { expiresIn: '7d' });
}
function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        return (0, response_1.error)(res, 'AUTH_REQUIRED', 'Authentication required', 401);
    }
    const token = header.slice(7);
    try {
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.auth = payload;
        next();
    }
    catch {
        return (0, response_1.error)(res, 'AUTH_REQUIRED', 'Invalid or expired token', 401);
    }
}
function authorize(...permissions) {
    return (req, res, next) => {
        const auth = req.auth;
        if (!auth)
            return (0, response_1.error)(res, 'AUTH_REQUIRED', 'Authentication required', 401);
        const hasAll = permissions.every(p => auth.permissions.includes(p));
        if (!hasAll)
            return (0, response_1.error)(res, 'FORBIDDEN', 'Insufficient permissions', 403);
        next();
    };
}
function scopeVendor(req, res, next) {
    const auth = req.auth;
    if (auth?.role === 'vendor' && !auth.vendorId) {
        return (0, response_1.error)(res, 'FORBIDDEN', 'Vendor identity not resolved', 403);
    }
    next();
}
