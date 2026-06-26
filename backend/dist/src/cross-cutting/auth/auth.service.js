"use strict";
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
        return { accessToken, refreshToken, user: { id: user.id, role: user.role.key, vendorId: user.vendorId } };
    },
    async logout(token) {
        await prisma_1.prisma.session.deleteMany({ where: { token } });
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
