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
import { ModuleGlpiService } from '@core/glpi/module-glpi.service';
import { ModuleSmtpService } from '@core/mail/module-smtp.service';
import { ModuleSharepointService } from '@core/sharepoint/module-sharepoint.service';
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
} from '@modules/salud-ocupacional/dto/so-module-settings.dto';
import {
  moduleGlpiSettingsBodySchema,
  type ModuleGlpiSettingsBody,
  moduleGlpiTestBodySchema,
  type ModuleGlpiTestBody,
} from './dto/glpi-settings.dto';
import {
  moduleSharepointSettingsBodySchema,
  type ModuleSharepointSettingsBody,
} from './dto/sharepoint-settings.dto';
import { SistemasModuleAdminGuard } from './guards/sistemas-module-admin.guard';

const MODULE_SLUG = 'sistemas';

/** Ajustes del módulo Sistemas. Ver `docs/features/sistemas-module-ajustes-spec.md`. */
@Controller('sistemas/module-settings')
@UseGuards(SistemasModuleAdminGuard)
export class SistemasModuleSettingsController {
  constructor(
    private readonly admin: AdminService,
    private readonly moduleSmtp: ModuleSmtpService,
    private readonly moduleGlpi: ModuleGlpiService,
    private readonly moduleSharepoint: ModuleSharepointService,
  ) {}

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

  @Get('glpi-settings')
  glpiSettings() {
    return this.moduleGlpi.getPublicSettings(MODULE_SLUG);
  }

  @Patch('glpi-settings')
  patchGlpiSettings(
    @Body(new ZodValidationPipe(moduleGlpiSettingsBodySchema)) body: ModuleGlpiSettingsBody,
  ) {
    return this.moduleGlpi.upsert(MODULE_SLUG, body);
  }

  @Post('glpi-settings/test')
  testGlpiConnection(
    @Body(new ZodValidationPipe(moduleGlpiTestBodySchema)) body: ModuleGlpiTestBody,
  ) {
    const hasInline =
      Boolean(body.glpi_db_host?.trim()) ||
      Boolean(body.glpi_db_user?.trim()) ||
      Boolean(body.glpi_db_name?.trim());
    return this.moduleGlpi.testConnection(MODULE_SLUG, hasInline ? body : undefined);
  }

  @Get('sharepoint-settings')
  sharepointSettings() {
    return this.moduleSharepoint.getPublicSettings(MODULE_SLUG);
  }

  @Patch('sharepoint-settings')
  patchSharepointSettings(
    @Body(new ZodValidationPipe(moduleSharepointSettingsBodySchema)) body: ModuleSharepointSettingsBody,
  ) {
    return this.moduleSharepoint.upsert(MODULE_SLUG, body);
  }

  @Post('sharepoint-settings/test')
  sharepointTestConnection() {
    return this.moduleSharepoint.testGraphToken(MODULE_SLUG);
  }

  @Get('rbac-catalog')
  rbacCatalog() {
    return this.admin.getRbacCatalogForModule(MODULE_SLUG);
  }

  @Get('profile-action-catalog')
  profileActionCatalog() {
    return this.admin.getSoProfileActionCatalogForModule(MODULE_SLUG);
  }

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
