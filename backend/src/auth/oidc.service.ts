import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

/**
 * Verifies Authentik access tokens so OuchTracker can be entered through the
 * same single sign-on as Trifylli.
 *
 * Authentik answers only "who are you". The access token is an RS256 JWT we
 * validate against Authentik's published JWKS — never a shared secret, so no
 * credential travels between the two systems. "What you may do" is still the
 * OuchTracker account's own role, decided here on provisioning, not a claim.
 */
export interface OidcClaims {
  sub: string;
  email: string;
  name?: string;
}

@Injectable()
export class OidcService {
  private readonly logger = new Logger(OidcService.name);
  private jwks?: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly config: ConfigService) {}

  /** `false` when SSO env is absent — the endpoint then answers 401, never crashes. */
  get configured(): boolean {
    return Boolean(this.issuer && this.audience && this.jwksUri);
  }

  private get issuer(): string | undefined {
    return this.config.get<string>('OIDC_ISSUER');
  }
  private get audience(): string | undefined {
    return this.config.get<string>('OIDC_AUDIENCE');
  }
  private get jwksUri(): string | undefined {
    return this.config.get<string>('OIDC_JWKS_URI');
  }

  async verify(token: string): Promise<OidcClaims> {
    if (!this.configured) {
      throw new UnauthorizedException('Το single sign-on δεν έχει ρυθμιστεί σε αυτόν τον διακομιστή.');
    }

    // Lazily built, then cached by jose (keys are fetched once and rotated on
    // demand) — so we do not hammer Authentik on every login.
    this.jwks ??= createRemoteJWKSet(new URL(this.jwksUri!));

    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['RS256'],
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Απόρριψη token SSO: ${message}`);
      throw new UnauthorizedException('Μη έγκυρο διακριτικό single sign-on.');
    }

    const sub = typeof payload.sub === 'string' ? payload.sub : '';
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
    if (!sub) throw new UnauthorizedException('Το token δεν περιέχει sub.');
    // Χωρίς email δεν μπορούμε να δέσουμε την ταυτότητα με λογαριασμό OuchTracker.
    if (!email) throw new UnauthorizedException('Το token δεν περιέχει email — ζητήστε το scope "email".');

    const name = typeof payload.name === 'string' ? payload.name : undefined;
    return { sub, email, name };
  }
}
