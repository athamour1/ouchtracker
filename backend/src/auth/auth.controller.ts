import { Controller, Post, Get, UseGuards, Request, Body } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OidcService } from './oidc/oidc.service';
import { isLocalLoginEnabled } from './oidc/oidc.config';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private oidc: OidcService,
    private config: ConfigService,
  ) {}

  /**
   * GET /api/auth/config — public; tells the login page which sign-in methods to show.
   */
  @Get('config')
  getConfig() {
    return {
      localLoginEnabled: isLocalLoginEnabled(this.config),
      sso: {
        enabled: this.oidc.enabled,
        providerName: this.oidc.settings.providerName,
      },
    };
  }

  /**
   * POST /api/auth/login
   * Body: { email, password, stayLoggedIn? }
   */
  @UseGuards(LocalAuthGuard)
  @Post('login')
  login(@Request() req, @Body() body: { stayLoggedIn?: boolean }) {
    return this.authService.login(req.user, body.stayLoggedIn ?? false);
  }

  /**
   * POST /api/auth/refresh
   * Body: { userId, refreshToken }
   */
  @Post('refresh')
  refresh(@Body() body: { userId: string; refreshToken: string }) {
    return this.authService.refresh(body.userId, body.refreshToken);
  }

  /**
   * POST /api/auth/logout
   * Invalidates the stored refresh token.
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Request() req) {
    return this.authService.logout(req.user.id);
  }

  /**
   * GET /api/auth/me — returns full user profile including locale
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Request() req) {
    return this.authService.getProfile(req.user.id);
  }
}
