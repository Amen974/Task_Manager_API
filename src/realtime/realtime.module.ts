import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { WorkspaceModule } from '../workspace/workspace.module';
import { JwtModule } from '@nestjs/jwt';
import { StringValue } from 'ms';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    WorkspaceModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('ACCESS_TOKEN_SECRET'),
        signOptions: {
          expiresIn: config.get<string>(
            'ACCESS_TOKEN_EXPIRES_IN',
          ) as StringValue,
        },
      }),
    }),
  ],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
