import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Strip sensitive fields. `hasPassword` is false for SSO-only users, so the
 * frontend can hide the change-password form.
 */
function toSafeUser<T extends { password: string | null; refreshTokenHash: string | null; oidcSubject: string | null }>(
  user: T,
) {
  const { password, refreshTokenHash: _rt, oidcSubject: _sub, ...result } = user;
  return { ...result, hasPassword: !!password };
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // SSO-only users have no password and can't use password login
    if (!user || !user.isActive || !user.password) return null;

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return null;

    // Strip sensitive fields; keep locale so frontend can set language immediately
    return toSafeUser(user);
  }

  /** Active user without sensitive fields, or null. Used after SSO login. */
  async getActiveUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) return null;
    return toSafeUser(user);
  }

  async login(user: { id: string; email: string; role: string }, stayLoggedIn: boolean) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    if (!stayLoggedIn) {
      // Clear any stored refresh token — session is ephemeral
      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshTokenHash: null },
      });
      return { accessToken, refreshToken: null, user };
    }

    // Generate a cryptographically random refresh token
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const hash = await bcrypt.hash(refreshToken, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: hash },
    });

    return { accessToken, refreshToken, user };
  }

  async refresh(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive || !user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const valid = await bcrypt.compare(token, user.refreshTokenHash);
    if (!valid) throw new UnauthorizedException('Invalid refresh token');

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    // Rotate: issue a new refresh token each time
    const newRefreshToken = crypto.randomBytes(40).toString('hex');
    const hash = await bcrypt.hash(newRefreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: hash },
    });

    return { accessToken, refreshToken: newRefreshToken, user: toSafeUser(user) };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, fullName: true,
        role: true, isActive: true, locale: true,
        createdAt: true, updatedAt: true, password: true,
      },
    });
    if (!user) throw new Error('User not found');
    const { password, ...profile } = user;
    return { ...profile, hasPassword: !!password };
  }
}
