import {
  Controller,
  Post,
  Get,
  UseGuards,
  Request,
  Body,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * POST /api/auth/oidc — single sign-on exchange.
   *
   * The frontend obtains an Authentik access token (silently, reusing the
   * session shared with Trifylli) and posts it here; we return an ordinary
   * OuchTracker session. Token may arrive in the body or as a Bearer header.
   */
  @Post('oidc')
  oidc(
    @Body() body: { token?: string; stayLoggedIn?: boolean },
    @Headers('authorization') authorization?: string,
  ) {
    const bearer = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
    const token = body.token ?? bearer;
    if (!token) throw new UnauthorizedException('Λείπει το διακριτικό single sign-on.');
    return this.authService.oidcLogin(token, body.stayLoggedIn ?? false);
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
