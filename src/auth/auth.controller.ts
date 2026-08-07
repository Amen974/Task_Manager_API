import {
  Body,
  Controller,
  Post,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateDto, LoginDto } from './auth.dto';
import { ConfigService } from '@nestjs/config';
import express from 'express';
import { RefreshTokenService } from './refresh-token.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  @Post('register')
  @Public()
  async createUser(
    @Body() body: CreateDto,
    @Res({ passthrough: true }) res: express.Response,
  ): Promise<{ access_token: string }> {
    const { access_token, refresh_token } =
      await this.authService.createUser(body);

    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
    });

    return { access_token };
  }

  @Post('login')
  @Public()
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: express.Response,
  ): Promise<{ access_token: string }> {
    const { access_token, refresh_token } = await this.authService.login(body);

    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
    });

    return { access_token };
  }

  @Post('refresh')
  @Public()
  async refresh(
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ): Promise<{ access_token: string }> {
    const cookies = req.cookies as Record<string, string | undefined>;
    const refreshToken = cookies.refresh_token;
    if (!refreshToken)
      throw new UnauthorizedException(
        'refresh in POST didnt find refreshToken',
      );

    const { userId, familyId } =
      await this.refreshTokenService.validateRefreshToken(refreshToken);

    const { access_token, refresh_token } = await this.authService.createTokens(
      userId,
      familyId,
    );

    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
    });

    return { access_token };
  }

  @Post('logout')
  @Public()
  async logout(
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ): Promise<void | string> {
    const cookies = req.cookies as Record<string, string | undefined>;
    const refreshToken = cookies.refresh_token;
    if (!refreshToken)
      throw new UnauthorizedException('no refreshToken in cookies');

    await this.authService.logout(refreshToken);

    res.clearCookie('refresh_token');
  }
}
