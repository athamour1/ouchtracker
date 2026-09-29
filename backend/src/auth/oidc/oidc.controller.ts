import {
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from '../auth.service';
import { OidcExchangeDto } from '../dto/oidc-exchange.dto';
import { OidcService } from './oidc.service';

const STATE_COOKIE = 'ot_oidc_state';

@Controller('auth/oidc')
export class OidcController {
  private readonly logger = new Logger(OidcController.name);

  constructor(
    private oidc: OidcService,
    private authService: AuthService,
  ) {}

  /**
   * GET /api/auth/oidc/login?stayLoggedIn=true&redirect=/my-kits
   * Browser navigates here; it gets redirected to the SSO provider.
   */
  @Get('login')
  async login(
    @Query('stayLoggedIn') stayLoggedIn: string | undefined,
    @Query('redirect') redirect: string | undefined,
    @Res() res: Response,
  ) {
    this.ensureEnabled();
    let request: { url: string; stateCookie: string };
    try {
      request = await this.oidc.createAuthorizationRequest(
        stayLoggedIn === 'true',
        redirect,
      );
    } catch (err) {
      // Provider unreachable / misconfigured — back to the login page with an error
      this.logger.warn(`SSO login start failed: ${(err as Error).message}`);
      return res.redirect(
        302,
        `${this.oidc.settings.appUrl}/login?sso_error=provider_error`,
      );
    }
    const { url, stateCookie } = request;
    res.cookie(STATE_COOKIE, stateCookie, {
      httpOnly: true,
      // Lax so the cookie is sent on the top-level redirect back from the provider
      sameSite: 'lax',
      secure: this.oidc.settings.redirectUri.startsWith('https://'),
      maxAge: 10 * 60 * 1000,
      path: '/',
    });
    res.redirect(302, url);
  }

  /**
   * GET /api/auth/oidc/callback?code&state — the redirect URI registered at the provider.
   */
  @Get('callback')
  async callback(
    @Query() query: { code?: string; state?: string; error?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    this.ensureEnabled();
    const target = await this.oidc.handleCallback(
      query,
      readCookie(req, STATE_COOKIE),
    );
    res.clearCookie(STATE_COOKIE, { path: '/' });
    res.redirect(302, target);
  }

  /**
   * POST /api/auth/oidc/exchange
   * Body: { ticket } — one-time ticket from the callback redirect.
   * Returns the same payload as POST /api/auth/login.
   */
  @Post('exchange')
  async exchange(@Body() body: OidcExchangeDto) {
    this.ensureEnabled();
    const entry = this.oidc.consumeTicket(body.ticket);
    if (!entry)
      throw new UnauthorizedException('Invalid or expired SSO ticket');
    const user = await this.authService.getActiveUser(entry.userId);
    if (!user) throw new UnauthorizedException('User not found or inactive');
    return this.authService.login(user, entry.stayLoggedIn);
  }

  private ensureEnabled() {
    if (!this.oidc.enabled) throw new NotFoundException('SSO is not enabled');
  }
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0 && part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return undefined;
}
