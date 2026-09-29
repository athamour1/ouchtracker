import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import { isLocalLoginEnabled } from '../oidc/oidc.config';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string) {
    if (!isLocalLoginEnabled(this.config)) {
      throw new ForbiddenException('Password login is disabled — use SSO');
    }
    const user = await this.authService.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }
}
