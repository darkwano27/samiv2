import { Module, forwardRef } from '@nestjs/common';
import { MailModule } from '@core/mail/mail.module';
import { RbacModule } from '@modules/rbac/rbac.module';
import { AuthSignatureController } from './controllers/auth-signature.controller';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { EmailService } from './services/email.service';
import { LdapService } from './services/ldap.service';
import { SessionService } from './services/session.service';
import { UserSignatureService } from './services/user-signature.service';

@Module({
  imports: [MailModule, forwardRef(() => RbacModule)],
  controllers: [AuthController, AuthSignatureController],
  providers: [
    AuthService,
    UserSignatureService,
    LdapService,
    EmailService,
    SessionService,
  ],
  exports: [SessionService, UserSignatureService],
})
export class AuthModule {}
