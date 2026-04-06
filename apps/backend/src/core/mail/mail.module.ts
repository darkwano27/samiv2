import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '@core/database/database.module';
import { ModuleSmtpService } from './module-smtp.service';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [ModuleSmtpService],
  exports: [ModuleSmtpService],
})
export class MailModule {}
