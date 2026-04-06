import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ZodValidationPipe } from '@core/common/pipes/zod-validation.pipe';
import {
  moduleSmtpSettingsBodySchema,
  type ModuleSmtpSettingsBody,
  moduleSmtpTestBodySchema,
  type ModuleSmtpTestBody,
} from '@core/mail/module-smtp.dto';
import { ModuleSmtpService } from '@core/mail/module-smtp.service';
import {
  assignWorkerRoleBodySchema,
  type AssignWorkerRoleBody,
} from '../dto/admin.schemas';
import { SuperadminGuard } from '../guards/superadmin.guard';
import { AdminService } from '../services/admin.service';

const SYSTEM_MODULE_SLUG = 'system';

/**
 * Rutas bajo `/api/admin/*`. Solo **superadmin** (sesión + caché RBAC).
 * Ver `docs/features/rbac-admin-api.md`.
 */
@Controller('admin')
@UseGuards(SuperadminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly moduleSmtp: ModuleSmtpService,
  ) {}

  @Get('settings/email')
  systemEmailSettings() {
    return this.moduleSmtp.getPublicSettings(SYSTEM_MODULE_SLUG);
  }

  @Patch('settings/email')
  patchSystemEmailSettings(
    @Body(new ZodValidationPipe(moduleSmtpSettingsBodySchema)) body: ModuleSmtpSettingsBody,
  ) {
    return this.moduleSmtp.upsert(SYSTEM_MODULE_SLUG, body);
  }

  @Post('settings/email/test')
  postSystemEmailTest(
    @Body(new ZodValidationPipe(moduleSmtpTestBodySchema)) body: ModuleSmtpTestBody,
  ) {
    return this.moduleSmtp
      .sendTestEmail(SYSTEM_MODULE_SLUG, body.to)
      .then(() => ({ sent: true as const }));
  }

  @Get('workers/directory')
  workersDirectory() {
    return this.admin.listWorkersDirectory();
  }

  @Post('workers/:sapCode/unlock-local-auth')
  unlockLocalAuth(@Param('sapCode') sapCode: string) {
    return this.admin.unlockLocalAccount(sapCode);
  }

  @Get('rbac/catalog')
  rbacCatalog() {
    return this.admin.getRbacCatalog();
  }

  @Get('rbac/modules-summary')
  modulesSummary() {
    return this.admin.listModulesSummary();
  }

  @Get('rbac/workers/:workerId/assignments')
  listAssignments(@Param('workerId') workerId: string) {
    return this.admin.listWorkerAssignments(workerId);
  }

  @Post('rbac/worker-assignments')
  @UsePipes(new ZodValidationPipe(assignWorkerRoleBodySchema))
  assignRole(@Body() body: AssignWorkerRoleBody) {
    return this.admin.assignWorkerRole(body);
  }

  @Delete('rbac/assignments/:assignmentId')
  revokeAssignment(@Param('assignmentId') assignmentId: string) {
    return this.admin.revokeAssignment(assignmentId);
  }
}
