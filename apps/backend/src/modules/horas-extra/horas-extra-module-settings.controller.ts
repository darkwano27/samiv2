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
import { ModuleSmtpService } from '@core/mail/module-smtp.service';
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
import { HorasExtraModuleAdminGuard } from './guards/horas-extra-module-admin.guard';
import {
  patchSubdivisionAssignmentsBodySchema,
  type PatchSubdivisionAssignmentsBody,
} from './dto/workforce-assignments.dto';
import {
  workforceBoletaExportPatchSchema,
  type WorkforceBoletaExportPatchBody,
} from './dto/workforce-boleta-export.dto';
import { WorkforceBoletaExportService } from './workforce-boleta-export.service';
import { WorkforceOrgCatalogService } from './workforce-org-catalog.service';
import { WorkforceSubdivisionAssignmentsService } from './workforce-subdivision-assignments.service';
import { MODULE_SLUG_HORAS_EXTRA } from './workforce-aris.constants';

@Controller('horas-extra/module-settings')
@UseGuards(HorasExtraModuleAdminGuard)
export class HorasExtraModuleSettingsController {
  constructor(
    private readonly orgCatalog: WorkforceOrgCatalogService,
    private readonly assignments: WorkforceSubdivisionAssignmentsService,
    private readonly admin: AdminService,
    private readonly moduleSmtp: ModuleSmtpService,
    private readonly boletaExport: WorkforceBoletaExportService,
  ) {}

  @Get('worker-lookup')
  workerLookup(@Query('q') q?: string) {
    return this.admin.lookupWorkersForSoSettings(q ?? '');
  }

  @Get('org-catalog')
  getOrgCatalog() {
    return this.orgCatalog.listArisGroupsWithSubdivisions();
  }

  @Get('subdivision-assignments')
  subdivisionAssignments() {
    return this.assignments.listAll();
  }

  @Patch('subdivision-assignments')
  patchSubdivisionAssignments(
    @Body(new ZodValidationPipe(patchSubdivisionAssignmentsBodySchema)) body: PatchSubdivisionAssignmentsBody,
  ) {
    return this.assignments.replaceForSubdivision(body);
  }

  @Get('email-settings')
  emailSettings() {
    return this.moduleSmtp.getPublicSettings(MODULE_SLUG_HORAS_EXTRA);
  }

  @Patch('email-settings')
  patchEmailSettings(
    @Body(new ZodValidationPipe(moduleSmtpSettingsBodySchema)) body: ModuleSmtpSettingsBody,
  ) {
    return this.moduleSmtp.upsert(MODULE_SLUG_HORAS_EXTRA, body);
  }

  @Post('email-settings/test')
  sendTestEmail(
    @Body(new ZodValidationPipe(moduleSmtpTestBodySchema)) body: ModuleSmtpTestBody,
  ) {
    return this.moduleSmtp.sendTestEmail(MODULE_SLUG_HORAS_EXTRA, body.to).then(() => ({
      sent: true as const,
    }));
  }

  @Get('boleta-export-settings')
  boletaExportSettings() {
    return this.boletaExport.getPublic();
  }

  @Patch('boleta-export-settings')
  patchBoletaExportSettings(
    @Body(new ZodValidationPipe(workforceBoletaExportPatchSchema)) body: WorkforceBoletaExportPatchBody,
  ) {
    return this.boletaExport.upsert(body);
  }

  @Post('boleta-export-settings/test')
  boletaExportTest() {
    return this.boletaExport.testReachability();
  }

  @Get('rbac-catalog')
  rbacCatalog() {
    return this.admin.getRbacCatalogForModule(MODULE_SLUG_HORAS_EXTRA);
  }

  @Get('profile-action-catalog')
  profileActionCatalog() {
    return this.admin.getSoProfileActionCatalogForModule(MODULE_SLUG_HORAS_EXTRA);
  }

  @Get('members')
  members(
    @Query('search') search?: string,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const page = Math.max(1, parseInt(pageRaw ?? '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(limitRaw ?? '10', 10) || 10));
    return this.admin.listWorkersInModule(MODULE_SLUG_HORAS_EXTRA, { search, page, limit });
  }

  @Get('members/:workerId')
  memberDetail(@Param('workerId') workerId: string) {
    return this.admin.getMemberDetailForModule(workerId, MODULE_SLUG_HORAS_EXTRA);
  }

  @Delete('members/:workerId')
  revokeAllForMember(@Param('workerId') workerId: string) {
    return this.admin.revokeAllAssignmentsInModule(workerId, MODULE_SLUG_HORAS_EXTRA);
  }

  @Post('members/:workerId/profile')
  replaceMemberProfile(
    @Param('workerId') workerId: string,
    @Body(new ZodValidationPipe(replaceSoProfileBodySchema)) body: ReplaceSoProfileBody,
  ) {
    return this.admin.replaceModuleProfile(workerId.trim(), body.profile_slug, MODULE_SLUG_HORAS_EXTRA);
  }

  @Get('module-profiles')
  moduleProfiles() {
    return this.admin.listModuleProfiles(MODULE_SLUG_HORAS_EXTRA);
  }

  @Get('module-profiles/:profileId')
  moduleProfileDetail(@Param('profileId', ParseUUIDPipe) profileId: string) {
    return this.admin.getModuleProfileDetailForModule(profileId, MODULE_SLUG_HORAS_EXTRA);
  }

  @Post('module-profiles')
  createModuleProfile(
    @Body(new ZodValidationPipe(createSoModuleProfileBodySchema)) body: CreateSoModuleProfileBody,
  ) {
    return this.admin.createModuleProfileForModule(MODULE_SLUG_HORAS_EXTRA, body);
  }

  @Patch('module-profiles/:profileId')
  updateModuleProfile(
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Body(new ZodValidationPipe(updateSoModuleProfileBodySchema)) body: UpdateSoModuleProfileBody,
  ) {
    return this.admin.updateModuleProfileForModule(profileId, MODULE_SLUG_HORAS_EXTRA, body);
  }

  @Delete('module-profiles/:profileId')
  deleteModuleProfile(@Param('profileId', ParseUUIDPipe) profileId: string) {
    return this.admin.deleteModuleProfileForModule(profileId, MODULE_SLUG_HORAS_EXTRA);
  }

  @Get('permission-matrix')
  permissionMatrix() {
    return this.admin.getPermissionMatrixForModule(MODULE_SLUG_HORAS_EXTRA);
  }

  @Post('apply-profile')
  applyProfile(
    @Body(new ZodValidationPipe(applySoProfileBodySchema)) body: ApplySoProfileBody,
  ) {
    return this.admin.applyModuleProfile(body.worker_id, body.profile_slug, MODULE_SLUG_HORAS_EXTRA);
  }

  @Get('workers/:workerId/assignments')
  listAssignments(@Param('workerId') workerId: string) {
    return this.admin.listWorkerAssignmentsInModule(workerId, MODULE_SLUG_HORAS_EXTRA);
  }

  @Post('worker-assignments')
  assignRole(
    @Body(new ZodValidationPipe(assignWorkerRoleBodySchema)) body: AssignWorkerRoleBody,
  ) {
    return this.admin.assignWorkerRoleInModule(body, MODULE_SLUG_HORAS_EXTRA);
  }

  @Delete('assignments/:assignmentId')
  revoke(@Param('assignmentId', ParseUUIDPipe) assignmentId: string) {
    return this.admin.revokeAssignmentInModule(assignmentId, MODULE_SLUG_HORAS_EXTRA);
  }
}
