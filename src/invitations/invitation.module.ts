import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { InvitationService } from './invitation.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { InvitationController } from './invitation.controller';
import { EmailService } from '../email/email.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { StringValue } from 'ms';

@Module({
  imports: [
    DatabaseModule,
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
  ],
  controllers: [InvitationController],
  providers: [InvitationService, WorkspaceService, EmailService],
})
export class InvitationModule {}
