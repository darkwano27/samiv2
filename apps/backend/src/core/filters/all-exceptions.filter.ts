import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

const PG_ERROR_KEYS = [
  'code',
  'detail',
  'hint',
  'severity',
  'schema',
  'table',
  'column',
  'routine',
  'position',
] as const;

function pickPostgresFields(err: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of PG_ERROR_KEYS) {
    if (k in err && (err as Record<string, unknown>)[k] != null) {
      out[k] = (err as Record<string, unknown>)[k];
    }
  }
  return out;
}

function serializeUnknown(exception: unknown): Record<string, unknown> {
  if (exception instanceof Error) {
    const base: Record<string, unknown> = {
      name: exception.name,
      message: exception.message,
    };
    const pg = pickPostgresFields(exception);
    if (Object.keys(pg).length > 0) {
      base.postgres = pg;
    }
    return base;
  }
  return { message: String(exception) };
}

/**
 * En desarrollo: logs estructurados (incl. column/table/code de Postgres) y cuerpo JSON con detalle en 500.
 * En producción no se registra (usar solo el filtro por defecto de Nest).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response
        .status(status)
        .json(typeof body === 'string' ? { statusCode: status, message: body } : body);
      return;
    }

    const serialized = serializeUnknown(exception);
    const summary = `${request.method} ${request.url} → ${serialized.name ?? 'Error'}: ${serialized.message}`;
    this.logger.error(summary);
    this.logger.error(JSON.stringify(serialized, null, 2));
    if (exception instanceof Error && exception.stack) {
      this.logger.error(exception.stack);
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal Server Error',
      error: serialized,
    });
  }
}
