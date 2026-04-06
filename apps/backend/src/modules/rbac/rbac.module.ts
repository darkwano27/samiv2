import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { AdminController } from './controllers/admin.controller';
import { RbacSmokeController } from './controllers/rbac-smoke.controller';
import { RbacGuard } from './guards/rbac.guard';
import { SuperadminGuard } from './guards/superadmin.guard';
import { AdminService } from './services/admin.service';
import { PermissionCacheService } from './services/permission-cache.service';
import { RbacService } from './services/rbac.service';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [RbacSmokeController, AdminController],
  providers: [
    RbacService,
    PermissionCacheService,
    RbacGuard,
    SuperadminGuard,
    AdminService,
  ],
  exports: [RbacService, PermissionCacheService, RbacGuard, AdminService],
})
export class RbacModule {}
