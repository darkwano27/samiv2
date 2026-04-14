import { Module } from '@nestjs/common';
import { PdfModule } from '@core/pdf/pdf.module';
import { AuthModule } from '@modules/auth/auth.module';
import { RbacModule } from '@modules/rbac/rbac.module';
import { ConsultationsController } from './consultations.controller';
import { ConsultationsRepository } from './consultations.repository';
import { ConsultationsService } from './consultations.service';
import { SaludOcupacionalModuleAdminGuard } from './guards/salud-ocupacional-module-admin.guard';
import { SoModuleSettingsController } from './so-module-settings.controller';
import { SoReportsController } from './so-reports.controller';
import { SoReportsRepository } from './so-reports.repository';
import { SoReportsService } from './so-reports.service';

/**
 * Salud ocupacional — capas: controller → service → repository (Drizzle).
 * Spec: `.kiro/specs/sami-salud-ocupacional/`.
 */
@Module({
  imports: [AuthModule, RbacModule, PdfModule],
  controllers: [
    ConsultationsController,
    SoModuleSettingsController,
    SoReportsController,
  ],
  providers: [
    ConsultationsRepository,
    ConsultationsService,
    SoReportsRepository,
    SoReportsService,
    SaludOcupacionalModuleAdminGuard,
  ],
  exports: [ConsultationsService],
})
export class SaludOcupacionalModule {}
