import { Controller, Post, Get, UseGuards, Request, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

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
