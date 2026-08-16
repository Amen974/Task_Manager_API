import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [WorkspaceModule],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
