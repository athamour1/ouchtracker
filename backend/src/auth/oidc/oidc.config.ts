import { ConfigService } from '@nestjs/config';

/**
 * SSO (OpenID Connect) settings, read from env vars.
 *
 * Works with any standard OIDC provider — authentik, Keycloak, Authelia, …
 * SSO is completely off unless OIDC_ENABLED=true.
 */
export interface OidcSettings {
  enabled: boolean;
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
  /** Label shown on the login button, e.g. "authentik". */
  providerName: string;
  /** Members of this group get ADMIN, everyone else CHECKER. Empty = roles managed in OuchTracker. */
  adminGroup: string;
  /** Create an OuchTracker account the first time an unknown SSO user signs in. */
  autoCreateUsers: boolean;
  /** Public URL of the frontend — where the browser is sent after the SSO callback. */
  appUrl: string;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export function isLocalLoginEnabled(config: ConfigService): boolean {
  return bool(config.get<string>('LOCAL_LOGIN_ENABLED'), true);
}

export function loadOidcSettings(config: ConfigService): OidcSettings {
  const appUrl = (
    config.get<string>('APP_URL') ||
    config.get<string>('CORS_ORIGIN') ||
    'http://localhost:9000'
  ).replace(/\/+$/, '');

  return {
    enabled: bool(config.get<string>('OIDC_ENABLED'), false),
    issuer: config.get<string>('OIDC_ISSUER', ''),
    clientId: config.get<string>('OIDC_CLIENT_ID', ''),
    clientSecret: config.get<string>('OIDC_CLIENT_SECRET', ''),
    redirectUri:
      config.get<string>('OIDC_REDIRECT_URI') ||
      `${appUrl}/api/auth/oidc/callback`,
    scopes: config.get<string>('OIDC_SCOPES') || 'openid profile email',
    providerName: config.get<string>('OIDC_PROVIDER_NAME') || 'SSO',
    adminGroup: config.get<string>('OIDC_ADMIN_GROUP', ''),
    autoCreateUsers: bool(config.get<string>('OIDC_AUTO_CREATE_USERS'), true),
    appUrl,
  };
}
