import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { OidcService } from './oidc.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private oidc: OidcService,
  ) {}

  /** Emails that should always be ADMIN in OuchTracker, from OIDC_ADMIN_EMAILS. */
  private adminEmails(): Set<string> {
    const raw = this.config.get<string>('OIDC_ADMIN_EMAILS', '');
    return new Set(
      raw
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  /**
   * Single sign-on entry: an Authentik access token is exchanged for an
   * OuchTracker session. The account is provisioned on first arrival; the
   * admin-email list acts as a floor (it can promote to ADMIN but never
   * demotes a manually promoted user). The rest of the app keeps using the
   * same OuchTracker JWT it always has — only the door is new.
   */
  async oidcLogin(token: string, stayLoggedIn: boolean) {
    const claims = await this.oidc.verify(token);
    const shouldBeAdmin = this.adminEmails().has(claims.email);

    const existing = await this.prisma.user.findUnique({ where: { email: claims.email } });

    let user;
    if (existing) {
      if (!existing.isActive) throw new UnauthorizedException('Ο λογαριασμός είναι ανενεργός.');
      user = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          fullName: claims.name ?? existing.fullName,
          // Προαγωγή σε ADMIN αν είναι στη λίστα· ποτέ υποβιβασμός.
          role: shouldBeAdmin && existing.role !== 'ADMIN' ? 'ADMIN' : existing.role,
        },
      });
    } else {
      // Ο λογαριασμός SSO δεν έχει τοπικό κωδικό: βάζουμε τυχαίο hash ώστε η
      // σύνδεση με email/κωδικό να είναι αδύνατη — η είσοδος γίνεται μόνο μέσω
      // Authentik.
      const unusable = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      user = await this.prisma.user.create({
        data: {
          email: claims.email,
          password: unusable,
          fullName: claims.name ?? claims.email,
          role: shouldBeAdmin ? 'ADMIN' : 'CHECKER',
          locale: 'el',
        },
      });
    }

    const { password: _pw, refreshTokenHash: _rt, ...safeUser } = user;
    return this.login(safeUser, stayLoggedIn);
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) return null;

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return null;

    // Strip sensitive fields; keep locale so frontend can set language immediately
    const { password: _pw, refreshTokenHash: _rt, ...result } = user;
    return result;
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

    const { password: _pw, refreshTokenHash: _rt, ...safeUser } = user;
    return { accessToken, refreshToken: newRefreshToken, user: safeUser };
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
        createdAt: true, updatedAt: true,
      },
    });
    if (!user) throw new Error('User not found');
    return user;
  }
}
