import { Module } from '@nestjs/common';
import { DatabaseModule } from '@core/database/database.module';
import { ModuleGlpiService } from './module-glpi.service';

@Module({
  imports: [DatabaseModule],
  providers: [ModuleGlpiService],
  exports: [ModuleGlpiService],
})
export class GlpiModule {}
