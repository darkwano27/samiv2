import { Module } from '@nestjs/common';
import { GlpiModule } from '@core/glpi/glpi.module';
import { PdfModule } from '@core/pdf/pdf.module';
import { SharepointModule } from '@core/sharepoint/sharepoint.module';
import { AuthModule } from '@modules/auth/auth.module';
import { RbacModule } from '@modules/rbac/rbac.module';
import { AsignacionBienesActaService } from './asignacion-bienes/asignacion-bienes-acta.service';
import { AsignacionBienesController } from './asignacion-bienes/asignacion-bienes.controller';
import { AsignacionBienesService } from './asignacion-bienes/asignacion-bienes.service';
import { SistemasModuleAdminGuard } from './guards/sistemas-module-admin.guard';
import { MisEquiposController } from './mis-equipos/mis-equipos.controller';
import { SistemasModuleSettingsController } from './sistemas-module-settings.controller';

@Module({
  imports: [AuthModule, RbacModule, GlpiModule, SharepointModule, PdfModule],
  controllers: [SistemasModuleSettingsController, AsignacionBienesController, MisEquiposController],
  providers: [SistemasModuleAdminGuard, AsignacionBienesService, AsignacionBienesActaService],
})
export class SistemasModule {}
