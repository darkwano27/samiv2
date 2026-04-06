import { Controller, Get } from '@nestjs/common';
import { RequirePermission } from '../decorators/require-permission.decorator';

/**
 * Solo para verificar el guard en desarrollo / Postman.
 * Requiere asignación con permiso `read` sobre feature `listar` de `mis-consultas`
 * (tras `seed:rbac` + fila en `worker_role_assignments`), o superadmin, o admin de módulo.
 */
@Controller('rbac-smoke')
export class RbacSmokeController {
  @Get()
  @RequirePermission('mis-consultas', 'listar', 'read')
  ping() {
    return { ok: true as const, message: 'RBAC guard OK' };
  }
}
