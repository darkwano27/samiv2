import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { RbacModule } from '@modules/rbac/rbac.module';
import { HorasExtraModuleAdminGuard } from './guards/horas-extra-module-admin.guard';
import { HorasExtraModuleSettingsController } from './horas-extra-module-settings.controller';
import { WorkforceBoletaExportService } from './workforce-boleta-export.service';
import { WorkforceOrgCatalogService } from './workforce-org-catalog.service';
import { WorkforceSubdivisionAssignmentsService } from './workforce-subdivision-assignments.service';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [HorasExtraModuleSettingsController],
  providers: [
    HorasExtraModuleAdminGuard,
    WorkforceOrgCatalogService,
    WorkforceSubdivisionAssignmentsService,
    WorkforceBoletaExportService,
  ],
})
export class HorasExtraModule {}
