import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from '@core/config/env.validation';
import { DatabaseModule } from '@core/database/database.module';
import { MailModule } from '@core/mail/mail.module';
import { PdfModule } from '@core/pdf/pdf.module';
import { RedisModule } from '@core/redis/redis.module';
import { HealthModule } from '@core/health/health.module';
import { AuthModule } from '@modules/auth/auth.module';
import { RbacGuard } from '@modules/rbac/guards/rbac.guard';
import { RbacModule } from '@modules/rbac/rbac.module';
import { SaludOcupacionalModule } from '@modules/salud-ocupacional/salud-ocupacional.module';
import { HorasExtraModule } from '@modules/horas-extra/horas-extra.module';
import { SistemasModule } from '@modules/sistemas/sistemas.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: Number(config.get('THROTTLER_TTL', 60_000)),
            limit: Number(config.get('THROTTLER_LIMIT', 100)),
          },
        ],
      }),
    }),
    DatabaseModule,
    MailModule,
    PdfModule,
    RedisModule,
    HealthModule,
    AuthModule,
    RbacModule,
    SaludOcupacionalModule,
    SistemasModule,
    HorasExtraModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: RbacGuard },
  ],
})
export class AppModule {}
