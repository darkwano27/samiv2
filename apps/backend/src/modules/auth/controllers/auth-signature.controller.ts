import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ZodValidationPipe } from '@core/common/pipes/zod-validation.pipe';
import {
  patchUserSignatureSchema,
  type PatchUserSignatureBody,
} from '../user-signature.schemas';
import { UserSignatureService } from '../services/user-signature.service';

@Controller('auth')
export class AuthSignatureController {
  constructor(private readonly userSignature: UserSignatureService) {}

  @Get('me/signature')
  async getMySignature(@Req() req: Request) {
    const token = req.cookies?.sami_session as string | undefined;
    return this.userSignature.getForSessionToken(token);
  }

  @Patch('me/signature')
  async patchMySignature(
    @Req() req: Request,
    @Body(new ZodValidationPipe(patchUserSignatureSchema)) body: PatchUserSignatureBody,
  ) {
    const token = req.cookies?.sami_session as string | undefined;
    return this.userSignature.patchForSessionToken(token, body);
  }
}
