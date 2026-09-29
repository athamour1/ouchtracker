import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { loadOidcSettings, OidcSettings } from './oidc.config';

interface DiscoveryDocument {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
}

/** Contents of the short-lived, signed cookie that carries login state across the redirect. */
interface LoginState {
  state: string;
  codeVerifier: string;
  stayLoggedIn: boolean;
  redirect: string;
}

export interface OidcClaims {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  groups?: string[];
}

/** Error codes are passed to the frontend as `?sso_error=<code>` and translated there. */
export type OidcErrorCode =
  | 'provider_error'
  | 'invalid_state'
  | 'missing_email'
  | 'not_registered'
  | 'account_conflict'
  | 'inactive';

export class OidcError extends Error {
  constructor(
    public readonly code: OidcErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }
}

const TICKET_TTL_MS = 60_000;

/**
 * OpenID Connect login (authorization code flow + PKCE) against a self-hosted
 * provider such as authentik.
 *
 * The provider is only used to prove who the user is. Once that's known, the
 * normal OuchTracker access/refresh tokens are issued, so the rest of the API,
 * the role guards and the offline PWA work exactly as with password login.
 *
 * Tokens are fetched server-to-server over TLS with the client secret, and the
 * identity comes from the userinfo endpoint, so the ID token signature doesn't
 * need to be verified here (OIDC Core §3.1.3.7).
 */
@Injectable()
export class OidcService {
  private readonly logger = new Logger(OidcService.name);
  readonly settings: OidcSettings;
  private discovery?: Promise<DiscoveryDocument>;
  /** One-time tickets handed to the frontend after the callback, exchanged for app tokens. */
  private readonly tickets = new Map<
    string,
    { userId: string; stayLoggedIn: boolean; expiresAt: number }
  >();
  /** Separate secret so a state cookie can never be used as an access token. */
  private readonly stateSecret: string;

  constructor(
    config: ConfigService,
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {
    this.settings = loadOidcSettings(config);
    this.stateSecret = `${config.get<string>('JWT_SECRET', 'changeme')}:oidc-state`;

    if (this.settings.enabled) {
      const required: Array<[string, string]> = [
        ['OIDC_ISSUER', this.settings.issuer],
        ['OIDC_CLIENT_ID', this.settings.clientId],
        ['OIDC_CLIENT_SECRET', this.settings.clientSecret],
      ];
      const missing = required
        .filter(([, value]) => !value)
        .map(([name]) => name);
      if (missing.length) {
        throw new Error(
          `OIDC_ENABLED=true but these env vars are missing: ${missing.join(', ')}`,
        );
      }
      this.logger.log(
        `SSO enabled via ${this.settings.providerName} (${this.settings.issuer})`,
      );
    }
  }

  get enabled(): boolean {
    return this.settings.enabled;
  }

  // ── Step 1: send the browser to the provider ─────────────────────────────

  async createAuthorizationRequest(
    stayLoggedIn: boolean,
    redirect: string | undefined,
  ) {
    const { authorization_endpoint } = await this.getDiscovery();

    const state = crypto.randomBytes(24).toString('base64url');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    const url = new URL(authorization_endpoint);
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: this.settings.clientId,
      redirect_uri: this.settings.redirectUri,
      scope: this.settings.scopes,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    }).toString();

    const payload: LoginState = {
      state,
      codeVerifier,
      stayLoggedIn,
      redirect: safeRedirect(redirect),
    };
    const stateCookie = this.jwtService.sign(payload, {
      secret: this.stateSecret,
      expiresIn: '10m',
    });

    return { url: url.toString(), stateCookie };
  }

  // ── Step 2: provider redirects back with ?code&state ─────────────────────

  /** Returns the frontend URL the browser should be sent to. Never throws. */
  async handleCallback(
    query: { code?: string; state?: string; error?: string },
    stateCookie: string | undefined,
  ): Promise<string> {
    try {
      const login = this.readState(stateCookie, query.state);
      if (query.error)
        throw new OidcError(
          'provider_error',
          `Provider returned error: ${query.error}`,
        );
      if (!query.code)
        throw new OidcError('provider_error', 'Missing authorization code');

      const claims = await this.fetchClaims(query.code, login.codeVerifier);
      const user = await this.resolveUser(claims);

      const ticket = this.issueTicket(user.id, login.stayLoggedIn);
      // Fragment, not query string: never reaches server/proxy logs
      const fragment = new URLSearchParams({
        ticket,
        redirect: login.redirect,
      });
      return `${this.settings.appUrl}/auth/callback#${fragment.toString()}`;
    } catch (err) {
      const code: OidcErrorCode =
        err instanceof OidcError ? err.code : 'provider_error';
      this.logger.warn(`SSO login failed (${code}): ${(err as Error).message}`);
      return `${this.settings.appUrl}/login?sso_error=${code}`;
    }
  }

  // ── Step 3: frontend swaps the one-time ticket for app tokens ────────────

  consumeTicket(
    ticket: string,
  ): { userId: string; stayLoggedIn: boolean } | null {
    this.pruneTickets();
    const entry = this.tickets.get(ticket);
    if (!entry) return null;
    this.tickets.delete(ticket);
    return { userId: entry.userId, stayLoggedIn: entry.stayLoggedIn };
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private readState(
    cookie: string | undefined,
    state: string | undefined,
  ): LoginState {
    if (!cookie || !state)
      throw new OidcError('invalid_state', 'Missing state cookie or parameter');
    let login: LoginState;
    try {
      login = this.jwtService.verify<LoginState>(cookie, {
        secret: this.stateSecret,
      });
    } catch {
      throw new OidcError('invalid_state', 'State cookie invalid or expired');
    }
    const a = Buffer.from(login.state);
    const b = Buffer.from(state);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new OidcError('invalid_state', 'State mismatch');
    }
    return login;
  }

  private getDiscovery(): Promise<DiscoveryDocument> {
    if (!this.discovery) {
      const url = `${this.settings.issuer.replace(/\/*$/, '/')}.well-known/openid-configuration`;
      this.discovery = fetchJson<DiscoveryDocument>(url).catch(
        (err: unknown) => {
          this.discovery = undefined; // retry on next login
          throw err;
        },
      );
    }
    return this.discovery;
  }

  private async fetchClaims(
    code: string,
    codeVerifier: string,
  ): Promise<OidcClaims> {
    const { token_endpoint, userinfo_endpoint } = await this.getDiscovery();

    const tokens = await fetchJson<{ access_token?: string }>(token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.settings.redirectUri,
        code_verifier: codeVerifier,
        client_id: this.settings.clientId,
        client_secret: this.settings.clientSecret,
      }).toString(),
    });
    if (!tokens.access_token)
      throw new OidcError(
        'provider_error',
        'Token response had no access_token',
      );

    const claims = await fetchJson<OidcClaims>(userinfo_endpoint, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!claims.sub)
      throw new OidcError(
        'provider_error',
        'Userinfo response had no sub claim',
      );
    return claims;
  }

  /** Find the OuchTracker user for these claims — by subject, then by email — or create one. */
  async resolveUser(claims: OidcClaims) {
    const email = claims.email?.trim().toLowerCase();
    let user = await this.prisma.user.findUnique({
      where: { oidcSubject: claims.sub },
    });

    if (!user) {
      if (!email)
        throw new OidcError(
          'missing_email',
          'Provider did not return an email claim',
        );
      const byEmail = await this.prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
      });

      if (byEmail) {
        if (byEmail.oidcSubject) {
          throw new OidcError(
            'account_conflict',
            `${email} is already linked to another SSO account`,
          );
        }
        // Existing account (e.g. created by an admin) — link it to this SSO identity
        user = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: { oidcSubject: claims.sub },
        });
      } else if (this.settings.autoCreateUsers) {
        user = await this.prisma.user.create({
          data: {
            email,
            fullName: claims.name || claims.preferred_username || email,
            password: null,
            oidcSubject: claims.sub,
            role: this.roleFromGroups(claims) ?? Role.CHECKER,
          },
        });
        this.logger.log(`Created user ${email} from SSO login`);
      } else {
        throw new OidcError(
          'not_registered',
          `No OuchTracker account for ${email}`,
        );
      }
    }

    if (!user.isActive)
      throw new OidcError('inactive', `User ${user.email} is deactivated`);

    // Keep the role in sync with provider groups on every login
    const role = this.roleFromGroups(claims);
    if (role && role !== user.role) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { role },
      });
    }
    return user;
  }

  /** ADMIN/CHECKER from the groups claim, or null when roles are managed in OuchTracker. */
  private roleFromGroups(claims: OidcClaims): Role | null {
    if (!this.settings.adminGroup) return null;
    const groups = Array.isArray(claims.groups) ? claims.groups : [];
    return groups.includes(this.settings.adminGroup)
      ? Role.ADMIN
      : Role.CHECKER;
  }

  private issueTicket(userId: string, stayLoggedIn: boolean): string {
    this.pruneTickets();
    const ticket = crypto.randomBytes(32).toString('base64url');
    this.tickets.set(ticket, {
      userId,
      stayLoggedIn,
      expiresAt: Date.now() + TICKET_TTL_MS,
    });
    return ticket;
  }

  private pruneTickets() {
    const now = Date.now();
    for (const [key, entry] of this.tickets) {
      if (entry.expiresAt <= now) this.tickets.delete(key);
    }
  }
}

/** Only allow internal app paths (same rule as the login page). */
export function safeRedirect(raw: string | undefined): string {
  return raw?.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\')
    ? raw
    : '/dashboard';
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new OidcError(
      'provider_error',
      `${init?.method ?? 'GET'} ${url} → ${res.status} ${body.slice(0, 200)}`,
    );
  }
  return (await res.json()) as T;
}
