import { Module } from '@nestjs/common';
import { DatabaseModule } from '@core/database/database.module';
import { ModuleSharepointService } from './module-sharepoint.service';
import { O365GraphSharepointService } from './o365-graph-sharepoint.service';

@Module({
  imports: [DatabaseModule],
  providers: [ModuleSharepointService, O365GraphSharepointService],
  exports: [ModuleSharepointService, O365GraphSharepointService],
})
export class SharepointModule {}
