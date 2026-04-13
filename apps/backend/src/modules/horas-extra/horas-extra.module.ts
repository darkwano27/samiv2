import { Module } from '@nestjs/common';
import { PdfModule } from '@core/pdf/pdf.module';
import { AuthModule } from '@modules/auth/auth.module';
import { RbacModule } from '@modules/rbac/rbac.module';
import { HorasExtraModuleAdminGuard } from './guards/horas-extra-module-admin.guard';
import { HorasExtraModuleSettingsController } from './horas-extra-module-settings.controller';
import { AprobacionHorasExtraController } from './aprobacion-horas-extra.controller';
import { AprobacionHorasExtraService } from './aprobacion-horas-extra.service';
import { RegistroHorasExtraController } from './registro-horas-extra.controller';
import { RegistroHorasExtraService } from './registro-horas-extra.service';
import { WorkforceBoletaExportService } from './workforce-boleta-export.service';
import { WorkforceOrgCatalogService } from './workforce-org-catalog.service';
import { WorkforceSubdivisionAssignmentsService } from './workforce-subdivision-assignments.service';

@Module({
  imports: [AuthModule, RbacModule, PdfModule],
  controllers: [
    HorasExtraModuleSettingsController,
    RegistroHorasExtraController,
    AprobacionHorasExtraController,
  ],
  providers: [
    HorasExtraModuleAdminGuard,
    WorkforceOrgCatalogService,
    WorkforceSubdivisionAssignmentsService,
    WorkforceBoletaExportService,
    RegistroHorasExtraService,
    AprobacionHorasExtraService,
  ],
})
export class HorasExtraModule {}
