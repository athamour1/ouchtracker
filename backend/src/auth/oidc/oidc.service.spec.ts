import { createHash } from 'crypto';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OidcError, OidcService, safeRedirect } from './oidc.service';

const BASE_ENV = {
  OIDC_ENABLED: 'true',
  OIDC_ISSUER: 'https://auth.example.com/application/o/ouchtracker/',
  OIDC_CLIENT_ID: 'client',
  OIDC_CLIENT_SECRET: 'secret',
  APP_URL: 'https://ouch.example.com',
  JWT_SECRET: 'test-secret',
};

const baseUser = {
  id: 'u1',
  email: 'jane@example.com',
  fullName: 'Jane',
  role: Role.CHECKER,
  isActive: true,
  password: null,
  oidcSubject: null as string | null,
};

function setup(env: Record<string, string> = {}) {
  const config = new ConfigService({ ...BASE_ENV, ...env });
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(({ data }) => Promise.resolve({ ...baseUser, ...data })),
      create: jest.fn(({ data }) =>
        Promise.resolve({ ...baseUser, id: 'new', isActive: true, ...data }),
      ),
    },
  };
  const service = new OidcService(
    config,
    prisma as unknown as PrismaService,
    new JwtService({}),
  );
  return { service, prisma };
}

describe('OidcService', () => {
  it('refuses to start when enabled without required settings', () => {
    expect(() => setup({ OIDC_CLIENT_SECRET: '' })).toThrow(
      /OIDC_CLIENT_SECRET/,
    );
  });

  it('is disabled by default', () => {
    const service = new OidcService(
      new ConfigService({}),
      {} as PrismaService,
      new JwtService({}),
    );
    expect(service.enabled).toBe(false);
  });

  describe('resolveUser', () => {
    it('returns the user already linked to the subject', async () => {
      const { service, prisma } = setup();
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        oidcSubject: 'sub-1',
      });

      const user = await service.resolveUser({
        sub: 'sub-1',
        email: 'jane@example.com',
      });

      expect(user.id).toBe('u1');
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('links an existing account by email', async () => {
      const { service, prisma } = setup();
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue({
        ...baseUser,
        password: 'hash',
      });

      const user = await service.resolveUser({
        sub: 'sub-1',
        email: 'Jane@Example.com',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { oidcSubject: 'sub-1' },
      });
      expect(user.oidcSubject).toBe('sub-1');
    });

    it('rejects an email already linked to a different subject', async () => {
      const { service, prisma } = setup();
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue({
        ...baseUser,
        oidcSubject: 'other',
      });

      await expect(
        service.resolveUser({ sub: 'sub-1', email: 'jane@example.com' }),
      ).rejects.toMatchObject({
        code: 'account_conflict',
      });
    });

    it('creates a new user without a password when auto-create is on', async () => {
      const { service, prisma } = setup();
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);

      await service.resolveUser({
        sub: 'sub-1',
        email: 'new@example.com',
        name: 'New Person',
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'new@example.com',
          fullName: 'New Person',
          password: null,
          oidcSubject: 'sub-1',
          role: Role.CHECKER,
        },
      });
    });

    it('rejects unknown users when auto-create is off', async () => {
      const { service, prisma } = setup({ OIDC_AUTO_CREATE_USERS: 'false' });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.resolveUser({ sub: 'sub-1', email: 'new@example.com' }),
      ).rejects.toMatchObject({
        code: 'not_registered',
      });
    });

    it('rejects when no email claim is available for linking', async () => {
      const { service, prisma } = setup();
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.resolveUser({ sub: 'sub-1' }),
      ).rejects.toBeInstanceOf(OidcError);
    });

    it('rejects deactivated users', async () => {
      const { service, prisma } = setup();
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        oidcSubject: 'sub-1',
        isActive: false,
      });

      await expect(service.resolveUser({ sub: 'sub-1' })).rejects.toMatchObject(
        { code: 'inactive' },
      );
    });

    it('syncs the role from groups when OIDC_ADMIN_GROUP is set', async () => {
      const { service, prisma } = setup({
        OIDC_ADMIN_GROUP: 'ouchtracker-admins',
      });
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        oidcSubject: 'sub-1',
      });

      const user = await service.resolveUser({
        sub: 'sub-1',
        groups: ['ouchtracker-admins'],
      });

      expect(user.role).toBe(Role.ADMIN);
    });

    it('leaves the role alone when OIDC_ADMIN_GROUP is empty', async () => {
      const { service, prisma } = setup();
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        oidcSubject: 'sub-1',
        role: Role.ADMIN,
      });

      const user = await service.resolveUser({ sub: 'sub-1', groups: [] });

      expect(user.role).toBe(Role.ADMIN);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('handleCallback', () => {
    it('redirects to the login page with an error on a bad state', async () => {
      const { service } = setup();
      const url = await service.handleCallback(
        { code: 'c', state: 's' },
        'not-a-jwt',
      );
      expect(url).toBe(
        'https://ouch.example.com/login?sso_error=invalid_state',
      );
    });
  });

  describe('tickets', () => {
    it('can be used only once', () => {
      const { service } = setup();
      const ticket = (
        service as unknown as {
          issueTicket: (id: string, s: boolean) => string;
        }
      ).issueTicket('u1', true);
      expect(service.consumeTicket(ticket)).toEqual({
        userId: 'u1',
        stayLoggedIn: true,
      });
      expect(service.consumeTicket(ticket)).toBeNull();
    });
  });

  it('safeRedirect only allows internal paths', () => {
    expect(safeRedirect('/my-kits')).toBe('/my-kits');
    expect(safeRedirect('//evil.com')).toBe('/dashboard');
    expect(safeRedirect('/\\evil.com')).toBe('/dashboard');
    expect(safeRedirect('https://evil.com')).toBe('/dashboard');
    expect(safeRedirect(undefined)).toBe('/dashboard');
  });

  describe('full login flow against a mock provider', () => {
    let server: Server;
    let issuer: string;
    let lastChallenge = '';
    let tokenRequest: URLSearchParams | undefined;

    beforeAll(async () => {
      server = createServer((req, res) => {
        const url = new URL(req.url ?? '/', issuer);
        res.setHeader('Content-Type', 'application/json');
        if (url.pathname.endsWith('/.well-known/openid-configuration')) {
          res.end(
            JSON.stringify({
              authorization_endpoint: `${issuer}authorize`,
              token_endpoint: `${issuer}token`,
              userinfo_endpoint: `${issuer}userinfo`,
            }),
          );
        } else if (url.pathname.endsWith('/token')) {
          let body = '';
          req.on('data', (c: Buffer) => (body += c.toString()));
          req.on('end', () => {
            tokenRequest = new URLSearchParams(body);
            const verifier = tokenRequest.get('code_verifier') ?? '';
            const ok =
              createHash('sha256').update(verifier).digest('base64url') ===
              lastChallenge;
            res.statusCode = ok ? 200 : 400;
            res.end(JSON.stringify(ok ? { access_token: 'at' } : {}));
          });
        } else if (url.pathname.endsWith('/userinfo')) {
          res.end(
            JSON.stringify({
              sub: 'sub-1',
              email: 'jane@example.com',
              groups: ['admins'],
            }),
          );
        } else {
          res.statusCode = 404;
          res.end('{}');
        }
      });
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const { port } = server.address() as AddressInfo;
      issuer = `http://127.0.0.1:${port}/application/o/ouchtracker/`;
    });

    afterAll(() => server.close());

    it('exchanges the code with PKCE and hands back a one-time ticket', async () => {
      const { service, prisma } = setup({
        OIDC_ISSUER: issuer,
        OIDC_ADMIN_GROUP: 'admins',
      });
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        oidcSubject: 'sub-1',
      });

      const { url, stateCookie } = await service.createAuthorizationRequest(
        true,
        '/my-kits',
      );
      const authorize = new URL(url);
      expect(authorize.searchParams.get('code_challenge_method')).toBe('S256');
      expect(authorize.searchParams.get('redirect_uri')).toBe(
        'https://ouch.example.com/api/auth/oidc/callback',
      );
      lastChallenge = authorize.searchParams.get('code_challenge') ?? '';

      const target = await service.handleCallback(
        { code: 'the-code', state: authorize.searchParams.get('state') ?? '' },
        stateCookie,
      );

      expect(tokenRequest?.get('code')).toBe('the-code');
      expect(tokenRequest?.get('client_secret')).toBe('secret');
      const [base, fragment] = target.split('#');
      expect(base).toBe('https://ouch.example.com/auth/callback');
      const params = new URLSearchParams(fragment);
      expect(params.get('redirect')).toBe('/my-kits');
      expect(service.consumeTicket(params.get('ticket') ?? '')).toEqual({
        userId: 'u1',
        stayLoggedIn: true,
      });
      // Role synced from the admins group
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { role: Role.ADMIN },
      });
    });

    it('rejects a callback whose state does not match the cookie', async () => {
      const { service } = setup({ OIDC_ISSUER: issuer });
      const { stateCookie } = await service.createAuthorizationRequest(
        false,
        undefined,
      );

      const target = await service.handleCallback(
        { code: 'c', state: 'forged' },
        stateCookie,
      );
      expect(target).toBe(
        'https://ouch.example.com/login?sso_error=invalid_state',
      );
    });
  });
});
