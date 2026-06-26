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

    return { accessToken, refreshToken, user: { id: user.id, role: user.role.key, vendorId: user.vendorId } };
  },

  async logout(token: string) {
    await prisma.session.deleteMany({ where: { token } });
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
