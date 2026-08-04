import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from '../users/user.module';
import { StringValue } from 'ms';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshTokenService } from './refresh-token.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    DatabaseModule,
    UserModule,
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
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RefreshTokenService],
  exports: [AuthService],
})
export class AuthModule {}
