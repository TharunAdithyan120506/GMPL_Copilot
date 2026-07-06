import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../shared/prisma';
import { signToken, signRefreshToken } from './auth.middleware';
import { Errors } from '../../shared/errors';
import { AuthContext } from '../../shared/types';

export const AuthService = {
  async login(loginIdentifier: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { loginIdentifier },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        vendor: true,
      },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw Errors.unauthorized();
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw Errors.unauthorized();

    const permissions = user.role.permissions.map(rp => rp.permission.key);
    const authCtx: AuthContext = {
      userId: user.id,
      companyId: user.companyId,
      role: user.role.key as 'company' | 'vendor',
      vendorId: user.vendorId ?? undefined,
      permissions,
    };

    const accessToken = signToken(authCtx);
    const refreshToken = signRefreshToken(user.id);

    // Persist refresh token
    await prisma.session.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken, user: { id: user.id, role: user.role.key, vendorId: user.vendorId, permissions } };
  },

  async logout(token: string) {
    await prisma.session.deleteMany({ where: { token } });
  },

  /**
   * [FIX: AUTH-1] Refresh token rotation:
   * 1. Validate the refresh token signature and expiry
   * 2. Look it up in the session table (prevents reuse after logout)
   * 3. Issue a new access token
   * 4. Rotate the refresh token (delete old, insert new)
   */
  async refresh(refreshToken: string) {
    // Validate the JWT itself
    let payload: any;
    try {
      const jwt = await import('jsonwebtoken');
      payload = jwt.default.verify(refreshToken, process.env.JWT_SECRET!);
    } catch {
      throw Errors.unauthorized('Refresh token is invalid or expired');
    }

    if (payload.type !== 'refresh') throw Errors.unauthorized('Not a refresh token');

    // Validate it exists in session store (revocation check)
    const session = await prisma.session.findFirst({
      where: { token: refreshToken, expiresAt: { gt: new Date() } },
    });
    if (!session) throw Errors.unauthorized('Session not found or expired');

    // Load fresh user context
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    if (!user || !user.isActive || user.deletedAt) throw Errors.unauthorized();

    const permissions = user.role.permissions.map((rp: any) => rp.permission.key);
    const authCtx = {
      userId: user.id,
      companyId: user.companyId,
      role: user.role.key as 'company' | 'vendor',
      vendorId: user.vendorId ?? undefined,
      permissions,
    };

    const { signToken, signRefreshToken } = await import('./auth.middleware');
    const newAccessToken = signToken(authCtx);
    const newRefreshToken = signRefreshToken(user.id);

    // Rotate: delete old session, create new one
    await prisma.$transaction([
      prisma.session.delete({ where: { id: session.id } }),
      prisma.session.create({
        data: {
          userId: user.id,
          token: newRefreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  },

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        vendor: { select: { id: true, name: true, code: true } },
      },
    });
    if (!user) throw Errors.notFound('User');
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
