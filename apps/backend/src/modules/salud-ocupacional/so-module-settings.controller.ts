import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '@core/common/pipes/zod-validation.pipe';
import {
  assignWorkerRoleBodySchema,
  type AssignWorkerRoleBody,
} from '@modules/rbac/dto/admin.schemas';
import { AdminService } from '@modules/rbac/services/admin.service';
import {
  applySoProfileBodySchema,
  type ApplySoProfileBody,
  createSoModuleProfileBodySchema,
  type CreateSoModuleProfileBody,
  moduleSmtpSettingsBodySchema,
  type ModuleSmtpSettingsBody,
  moduleSmtpTestBodySchema,
  type ModuleSmtpTestBody,
  replaceSoProfileBodySchema,
  type ReplaceSoProfileBody,
  updateSoModuleProfileBodySchema,
  type UpdateSoModuleProfileBody,
} from './dto/so-module-settings.dto';
import { SaludOcupacionalModuleAdminGuard } from './guards/salud-ocupacional-module-admin.guard';
import { ModuleSmtpService } from '@core/mail/module-smtp.service';

const MODULE_SLUG = 'salud-ocupacional';

/**
 * Ajustes del módulo (roles en alcance SO). Ver `docs/features/so-module-settings-api.md`.
 */
@Controller('salud-ocupacional/module-settings')
@UseGuards(SaludOcupacionalModuleAdminGuard)
export class SoModuleSettingsController {
  constructor(
    private readonly admin: AdminService,
    private readonly moduleSmtp: ModuleSmtpService,
  ) {}

  /** SMTP del módulo (gestionable; contraseña nunca se devuelve en claro). */
  @Get('email-settings')
  emailSettings() {
    return this.moduleSmtp.getPublicSettings(MODULE_SLUG);
  }

  @Patch('email-settings')
  patchEmailSettings(
    @Body(new ZodValidationPipe(moduleSmtpSettingsBodySchema)) body: ModuleSmtpSettingsBody,
  ) {
    return this.moduleSmtp.upsert(MODULE_SLUG, body);
  }

  @Post('email-settings/test')
  sendTestEmail(
    @Body(new ZodValidationPipe(moduleSmtpTestBodySchema)) body: ModuleSmtpTestBody,
  ) {
    return this.moduleSmtp.sendTestEmail(MODULE_SLUG, body.to).then(() => ({ sent: true as const }));
  }

  @Get('rbac-catalog')
  rbacCatalog() {
    return this.admin.getRbacCatalogForModule(MODULE_SLUG);
  }

  /** Acciones disponibles por app para el modal Crear/Editar perfil (sin exponer nombres de rol). */
  @Get('profile-action-catalog')
  profileActionCatalog() {
    return this.admin.getSoProfileActionCatalogForModule(MODULE_SLUG);
  }

  /** Autocompletar por nombre o código SAP desde la tabla local `workers`. */
  @Get('worker-lookup')
  workerLookup(@Query('q') q?: string) {
    return this.admin.lookupWorkersForSoSettings(q ?? '');
  }

  @Get('members')
  members(
    @Query('search') search?: string,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const page = Math.max(1, parseInt(pageRaw ?? '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(limitRaw ?? '10', 10) || 10));
    return this.admin.listWorkersInModule(MODULE_SLUG, { search, page, limit });
  }

  @Get('members/:workerId')
  memberDetail(@Param('workerId') workerId: string) {
    return this.admin.getMemberDetailForModule(workerId, MODULE_SLUG);
  }

  @Delete('members/:workerId')
  revokeAllForMember(@Param('workerId') workerId: string) {
    return this.admin.revokeAllAssignmentsInModule(workerId, MODULE_SLUG);
  }

  @Post('members/:workerId/profile')
  replaceMemberProfile(
    @Param('workerId') workerId: string,
    @Body(new ZodValidationPipe(replaceSoProfileBodySchema)) body: ReplaceSoProfileBody,
  ) {
    return this.admin.replaceModuleProfile(
      workerId.trim(),
      body.profile_slug,
      MODULE_SLUG,
    );
  }

  @Get('module-profiles')
  moduleProfiles() {
    return this.admin.listModuleProfiles(MODULE_SLUG);
  }

  @Get('module-profiles/:profileId')
  moduleProfileDetail(@Param('profileId', ParseUUIDPipe) profileId: string) {
    return this.admin.getModuleProfileDetailForModule(profileId, MODULE_SLUG);
  }

  @Post('module-profiles')
  createModuleProfile(
    @Body(new ZodValidationPipe(createSoModuleProfileBodySchema)) body: CreateSoModuleProfileBody,
  ) {
    return this.admin.createModuleProfileForModule(MODULE_SLUG, body);
  }

  @Patch('module-profiles/:profileId')
  updateModuleProfile(
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Body(new ZodValidationPipe(updateSoModuleProfileBodySchema)) body: UpdateSoModuleProfileBody,
  ) {
    return this.admin.updateModuleProfileForModule(profileId, MODULE_SLUG, body);
  }

  @Delete('module-profiles/:profileId')
  deleteModuleProfile(@Param('profileId', ParseUUIDPipe) profileId: string) {
    return this.admin.deleteModuleProfileForModule(profileId, MODULE_SLUG);
  }

  @Get('permission-matrix')
  permissionMatrix() {
    return this.admin.getPermissionMatrixForModule(MODULE_SLUG);
  }

  @Post('apply-profile')
  applyProfile(
    @Body(new ZodValidationPipe(applySoProfileBodySchema)) body: ApplySoProfileBody,
  ) {
    return this.admin.applyModuleProfile(
      body.worker_id,
      body.profile_slug,
      MODULE_SLUG,
    );
  }

  @Get('workers/:workerId/assignments')
  listAssignments(@Param('workerId') workerId: string) {
    return this.admin.listWorkerAssignmentsInModule(workerId, MODULE_SLUG);
  }

  @Post('worker-assignments')
  assignRole(
    @Body(new ZodValidationPipe(assignWorkerRoleBodySchema)) body: AssignWorkerRoleBody,
  ) {
    return this.admin.assignWorkerRoleInModule(body, MODULE_SLUG);
  }

  @Delete('assignments/:assignmentId')
  revoke(@Param('assignmentId', ParseUUIDPipe) assignmentId: string) {
    return this.admin.revokeAssignmentInModule(assignmentId, MODULE_SLUG);
  }
}
