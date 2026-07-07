"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../../shared/prisma");
const auth_middleware_1 = require("./auth.middleware");
const errors_1 = require("../../shared/errors");
exports.AuthService = {
    async login(loginIdentifier, password) {
        const user = await prisma_1.prisma.user.findUnique({
            where: { loginIdentifier },
            include: {
                role: { include: { permissions: { include: { permission: true } } } },
                vendor: true,
            },
        });
        if (!user || !user.isActive || user.deletedAt) {
            throw errors_1.Errors.unauthorized();
        }
        const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!valid)
            throw errors_1.Errors.unauthorized();
        const permissions = user.role.permissions.map(rp => rp.permission.key);
        const authCtx = {
            userId: user.id,
            companyId: user.companyId,
            role: user.role.key,
            vendorId: user.vendorId ?? undefined,
            permissions,
        };
        const accessToken = (0, auth_middleware_1.signToken)(authCtx);
        const refreshToken = (0, auth_middleware_1.signRefreshToken)(user.id);
        // Persist refresh token
        await prisma_1.prisma.session.create({
            data: {
                userId: user.id,
                token: refreshToken,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });
        return { accessToken, refreshToken, user: { id: user.id, role: user.role.key, vendorId: user.vendorId, permissions } };
    },
    async logout(token) {
        await prisma_1.prisma.session.deleteMany({ where: { token } });
    },
    /**
     * [FIX: AUTH-1] Refresh token rotation:
     * 1. Validate the refresh token signature and expiry
     * 2. Look it up in the session table (prevents reuse after logout)
     * 3. Issue a new access token
     * 4. Rotate the refresh token (delete old, insert new)
     */
    async refresh(refreshToken) {
        // Validate the JWT itself
        let payload;
        try {
            const jwt = await Promise.resolve().then(() => __importStar(require('jsonwebtoken')));
            payload = jwt.default.verify(refreshToken, process.env.JWT_SECRET);
        }
        catch {
            throw errors_1.Errors.unauthorized('Refresh token is invalid or expired');
        }
        if (payload.type !== 'refresh')
            throw errors_1.Errors.unauthorized('Not a refresh token');
        // Validate it exists in session store (revocation check)
        const session = await prisma_1.prisma.session.findFirst({
            where: { token: refreshToken, expiresAt: { gt: new Date() } },
        });
        if (!session)
            throw errors_1.Errors.unauthorized('Session not found or expired');
        // Load fresh user context
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: payload.sub },
            include: { role: { include: { permissions: { include: { permission: true } } } } },
        });
        if (!user || !user.isActive || user.deletedAt)
            throw errors_1.Errors.unauthorized();
        const permissions = user.role.permissions.map((rp) => rp.permission.key);
        const authCtx = {
            userId: user.id,
            companyId: user.companyId,
            role: user.role.key,
            vendorId: user.vendorId ?? undefined,
            permissions,
        };
        const { signToken, signRefreshToken } = await Promise.resolve().then(() => __importStar(require('./auth.middleware')));
        const newAccessToken = signToken(authCtx);
        const newRefreshToken = signRefreshToken(user.id);
        // Rotate: delete old session, create new one
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.session.delete({ where: { id: session.id } }),
            prisma_1.prisma.session.create({
                data: {
                    userId: user.id,
                    token: newRefreshToken,
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                },
            }),
        ]);
        return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    },
    async me(userId) {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            include: {
                role: { include: { permissions: { include: { permission: true } } } },
                vendor: { select: { id: true, name: true, code: true } },
            },
        });
        if (!user)
            throw errors_1.Errors.notFound('User');
        return {
            id: user.id,
            role: user.role.key,
            companyId: user.companyId,
            vendorId: user.vendorId,
            vendor: user.vendor,
            permissions: user.role.permissions.map(rp => rp.permission.key),
        };
    },
};
