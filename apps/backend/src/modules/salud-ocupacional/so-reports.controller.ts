import {
  BadRequestException,
  Controller,
  Get,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ZodValidationPipe } from '@core/common/pipes/zod-validation.pipe';
import { RequirePermission } from '@modules/rbac/decorators/require-permission.decorator';
import type { SoReportFiltersQuery } from './dto/so-reports.dto';
import {
  soReportFiltersQuerySchema,
  soReportTopQuerySchema,
  soReportTrendQuerySchema,
} from './dto/so-reports.dto';
import { SoReportsService } from './so-reports.service';

@Controller('salud-ocupacional/reports')
export class SoReportsController {
  constructor(private readonly reports: SoReportsService) {}

  @Get('summary')
  @RequirePermission('reportes-so', 'ver', 'read')
  async summary(
    @Query(new ZodValidationPipe(soReportFiltersQuerySchema))
    q: SoReportFiltersQuery,
  ) {
    return this.reports.getSummary(q);
  }

  @Get('discharge-conditions')
  @RequirePermission('reportes-so', 'ver', 'read')
  async discharge(
    @Query(new ZodValidationPipe(soReportFiltersQuerySchema))
    q: SoReportFiltersQuery,
  ) {
    return this.reports.getDischargeConditions(q);
  }

  @Get('top-diagnoses')
  @RequirePermission('reportes-so', 'ver', 'read')
  async topDiagnoses(@Query() raw: Record<string, string | undefined>) {
    const parsed = soReportTopQuerySchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Query inválida',
        errors: parsed.error.flatten(),
      });
    }
    return this.reports.getTopDiagnoses(parsed.data);
  }

  @Get('by-division')
  @RequirePermission('reportes-so', 'ver', 'read')
  async byDivision(
    @Query(new ZodValidationPipe(soReportFiltersQuerySchema))
    q: SoReportFiltersQuery,
  ) {
    return this.reports.getByDivision(q);
  }

  @Get('subdivisions')
  @RequirePermission('reportes-so', 'ver', 'read')
  async subdivisions(
    @Query(new ZodValidationPipe(soReportFiltersQuerySchema))
    q: SoReportFiltersQuery,
  ) {
    return this.reports.getReportSubdivisions(q);
  }

  @Get('top-patients')
  @RequirePermission('reportes-so', 'ver', 'read')
  async topPatients(@Query() raw: Record<string, string | undefined>) {
    const parsed = soReportTopQuerySchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Query inválida',
        errors: parsed.error.flatten(),
      });
    }
    return this.reports.getTopPatients(parsed.data);
  }

  @Get('top-medications')
  @RequirePermission('reportes-so', 'ver', 'read')
  async topMedications(@Query() raw: Record<string, string | undefined>) {
    const parsed = soReportTopQuerySchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Query inválida',
        errors: parsed.error.flatten(),
      });
    }
    return this.reports.getTopMedications(parsed.data);
  }

  @Get('trend')
  @RequirePermission('reportes-so', 'ver', 'read')
  async trend(@Query() raw: Record<string, string | undefined>) {
    const parsed = soReportTrendQuerySchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Query inválida',
        errors: parsed.error.flatten(),
      });
    }
    return this.reports.getTrend(parsed.data);
  }

  @Get('export.pdf')
  @RequirePermission('reportes-so', 'ver', 'read')
  async exportPdf(
    @Query(new ZodValidationPipe(soReportFiltersQuerySchema))
    q: SoReportFiltersQuery,
  ): Promise<StreamableFile> {
    const buffer = await this.reports.renderPdf(q);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: 'attachment; filename="reporte-salud-ocupacional.pdf"',
    });
  }
}
