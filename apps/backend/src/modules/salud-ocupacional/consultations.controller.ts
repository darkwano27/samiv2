import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UsePipes,
} from '@nestjs/common';
import type { Request } from 'express';
import { ZodValidationPipe } from '@core/common/pipes/zod-validation.pipe';
import { SessionService } from '@modules/auth/services/session.service';
import { RequirePermission } from '@modules/rbac/decorators/require-permission.decorator';
import { PermissionCacheService } from '@modules/rbac/services/permission-cache.service';
import { RbacService } from '@modules/rbac/services/rbac.service';
import type { CachedPermissions } from '@modules/rbac/types/rbac-cache.types';
import { ConsultationsService } from './consultations.service';
import {
  createConsultationBodySchema,
  createDiagnosisBodySchema,
  createMedicineBodySchema,
  historialQuerySchema,
  myConsultationsQuerySchema,
  updateDiagnosisBodySchema,
  updateMedicineBodySchema,
  type CreateConsultationBody,
  type CreateDiagnosisBody,
  type CreateMedicineBody,
  type HistorialQuery,
  type MyConsultationsQuery,
  type UpdateDiagnosisBody,
  type UpdateMedicineBody,
} from './dto/consultations.dto';

@Controller('salud-ocupacional/consultations')
export class ConsultationsController {
  constructor(
    private readonly consultations: ConsultationsService,
    private readonly sessions: SessionService,
    private readonly permissionCache: PermissionCacheService,
    private readonly rbac: RbacService,
  ) {}

  /** Alta/edición de catálogo inventario: `update` o `delete` (p. ej. baja lógica). */
  private async assertInventarioCatalogWrite(cached: CachedPermissions) {
    const canUpdate = await this.rbac.canAccess(
      cached,
      'inventario-medico',
      'inventario',
      'update',
    );
    const canDelete = await this.rbac.canAccess(
      cached,
      'inventario-medico',
      'inventario',
      'delete',
    );
    if (!canUpdate && !canDelete) {
      throw new ForbiddenException({ message: 'Sin permiso para esta acción' });
    }
  }

  private async requireSessionPayload(req: Request) {
    const token = req.cookies?.sami_session as string | undefined;
    const session = await this.sessions.validateSession(token);
    if (!session) {
      throw new UnauthorizedException({ message: 'No autenticado' });
    }
    const cached = await this.permissionCache.getOrResolve(session.sapCode);
    return { session, cached };
  }

  @Get('sap-search')
  @RequirePermission('registro-consulta', 'operar', 'read')
  async sapSearch(@Query('q') q: string | undefined) {
    return this.consultations.sapSearch(q ?? '');
  }

  @Get('diagnoses')
  @RequirePermission('registro-consulta', 'operar', 'read')
  async listDiagnoses() {
    return this.consultations.listDiagnoses();
  }

  @Post('diagnoses')
  @RequirePermission('registro-consulta', 'operar', 'create')
  @UsePipes(new ZodValidationPipe(createDiagnosisBodySchema))
  async createDiagnosis(@Body() body: CreateDiagnosisBody) {
    return this.consultations.createDiagnosis(body);
  }

  @Get('medicines')
  @RequirePermission('registro-consulta', 'operar', 'read')
  async listMedicines() {
    return this.consultations.listMedicines();
  }

  @Get('medicines/search')
  @RequirePermission('registro-consulta', 'operar', 'read')
  async searchMedicines(@Query('q') q: string | undefined) {
    return this.consultations.searchMedicines(q ?? '');
  }

  @Post('medicines')
  @RequirePermission('registro-consulta', 'operar', 'create')
  @UsePipes(new ZodValidationPipe(createMedicineBodySchema))
  async createMedicine(@Body() body: CreateMedicineBody) {
    return this.consultations.createMedicine(body);
  }

  @Post()
  @RequirePermission('registro-consulta', 'operar', 'create')
  async createConsultation(
    @Req() req: Request,
    @Body(new ZodValidationPipe(createConsultationBodySchema))
    body: CreateConsultationBody,
  ) {
    const { session } = await this.requireSessionPayload(req);
    return this.consultations.createConsultation(
      body,
      session.sapCode,
      session.workerName,
    );
  }

  @Get('historial/filters')
  @RequirePermission('historial-medico', 'listar', 'read')
  async historialFilters() {
    return this.consultations.getHistorialFilterMeta();
  }

  @Get('historial/export-csv')
  @RequirePermission('historial-medico', 'listar', 'read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="historial-so.csv"')
  async historialExportCsv(@Query() raw: Record<string, string | undefined>) {
    const parsed = historialQuerySchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Query inválida',
        errors: parsed.error.flatten(),
      });
    }
    return this.consultations.buildHistorialCsv(parsed.data as HistorialQuery);
  }

  @Get('historial')
  @RequirePermission('historial-medico', 'listar', 'read')
  async historial(@Query() raw: Record<string, string | undefined>) {
    const parsed = historialQuerySchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Query inválida',
        errors: parsed.error.flatten(),
      });
    }
    return this.consultations.getHistorial(parsed.data as HistorialQuery);
  }

  @Get('my')
  @RequirePermission('mis-consultas', 'listar', 'read')
  async myConsultations(
    @Req() req: Request,
    @Query() raw: Record<string, string | undefined>,
  ) {
    const { session } = await this.requireSessionPayload(req);
    const parsed = myConsultationsQuerySchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Query inválida',
        errors: parsed.error.flatten(),
      });
    }
    return this.consultations.getMyConsultations(
      session.sapCode,
      parsed.data as MyConsultationsQuery,
    );
  }

  @Get('inventario/diagnoses')
  @RequirePermission('inventario-medico', 'inventario', 'read')
  async inventarioDiagnoses() {
    return this.consultations.listInventarioDiagnosesCatalog();
  }

  @Get('inventario/medicines')
  @RequirePermission('inventario-medico', 'inventario', 'read')
  async inventarioMedicines() {
    return this.consultations.listInventarioMedicinesCatalog();
  }

  @Post('inventario/diagnoses')
  @RequirePermission('inventario-medico', 'inventario', 'create')
  @UsePipes(new ZodValidationPipe(createDiagnosisBodySchema))
  async inventarioCreateDiagnosis(@Body() body: CreateDiagnosisBody) {
    return this.consultations.createDiagnosis(body);
  }

  @Post('inventario/medicines')
  @RequirePermission('inventario-medico', 'inventario', 'create')
  @UsePipes(new ZodValidationPipe(createMedicineBodySchema))
  async inventarioCreateMedicine(@Body() body: CreateMedicineBody) {
    return this.consultations.createMedicine(body);
  }

  @Patch('inventario/diagnoses/:id')
  async inventarioPatchDiagnosis(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateDiagnosisBodySchema))
    body: UpdateDiagnosisBody,
  ) {
    const { cached } = await this.requireSessionPayload(req);
    await this.assertInventarioCatalogWrite(cached);
    return this.consultations.updateDiagnosisCatalog(id, body);
  }

  @Patch('inventario/medicines/:id')
  async inventarioPatchMedicine(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateMedicineBodySchema))
    body: UpdateMedicineBody,
  ) {
    const { cached } = await this.requireSessionPayload(req);
    await this.assertInventarioCatalogWrite(cached);
    return this.consultations.updateMedicineCatalog(id, body);
  }

  @Get(':id')
  async getById(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const { session, cached } = await this.requireSessionPayload(req);
    return this.consultations.getConsultationDetail(
      id,
      cached,
      session.sapCode,
    );
  }
}
