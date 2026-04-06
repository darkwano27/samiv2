import { Body, Controller, Get, Post, Req, Res, UsePipes } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from '@core/common/pipes/zod-validation.pipe';
import {
  changePasswordSchema,
  identifySchema,
  loginSchema,
  recoverSchema,
  registerSchema,
  type ChangePasswordBody,
  type IdentifyBody,
  type LoginBody,
  type RecoverBody,
  type RegisterBody,
} from '../auth.schemas';
import { AuthService } from '../services/auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Get('me')
  async me(@Req() req: Request) {
    const token = req.cookies?.sami_session as string | undefined;
    return this.auth.getMeFromSessionToken(token);
  }

  private sessionCookieOptions() {
    return {
      httpOnly: true as const,
      sameSite: 'lax' as const,
      path: '/',
    };
  }

  private setSessionCookie(res: Response, token: string) {
    const maxAge = this.config.get<number>('SESSION_TTL', 86_400_000);
    res.cookie('sami_session', token, {
      ...this.sessionCookieOptions(),
      maxAge,
    });
  }

  private clearSessionCookie(res: Response) {
    res.clearCookie('sami_session', this.sessionCookieOptions());
  }

  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.sami_session as string | undefined;
    await this.auth.logout(token);
    this.clearSessionCookie(res);
    return { ok: true as const };
  }

  @Post('identify')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(identifySchema))
  async identify(@Body() body: IdentifyBody) {
    return this.auth.identify(body.sap_code);
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(loginSchema))
  async login(
    @Body() body: LoginBody,
    @Res({ passthrough: true }) res: Response,
  ) {
    const out = await this.auth.login(body.sap_code, body.password);
    if ('token' in out && out.token) {
      this.setSessionCookie(res, out.token);
    }
    return out;
  }

  @Post('register')
  @UsePipes(new ZodValidationPipe(registerSchema))
  async register(@Body() body: RegisterBody) {
    return this.auth.register(body.sap_code, body.dni);
  }

  @Post('recover')
  @UsePipes(new ZodValidationPipe(recoverSchema))
  async recover(@Body() body: RecoverBody) {
    return this.auth.recover(body.sap_code, body.dni);
  }

  @Post('change-password')
  @UsePipes(new ZodValidationPipe(changePasswordSchema))
  async changePassword(
    @Body() body: ChangePasswordBody,
    @Res({ passthrough: true }) res: Response,
  ) {
    const out = await this.auth.changePassword(body.temp_token, body.new_password);
    this.setSessionCookie(res, out.token);
    return out;
  }
}
