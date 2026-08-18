import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { InvitationService } from './invitation.service';
import { InvitationController } from './invitation.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { StringValue } from 'ms';
import { WorkspaceModule } from '../workspace/workspace.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    DatabaseModule,
    WorkspaceModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('INVITATION_TOKEN_SECRET'),
        signOptions: {
          expiresIn: config.get<string>(
            'INVITATION_TOKEN_EXPIRES_IN',
          ) as StringValue,
        },
      }),
    }),
    BullModule.registerQueue({
      name: 'email',
    }),
  ],
  controllers: [InvitationController],
  providers: [InvitationService],
})
export class InvitationModule {}
