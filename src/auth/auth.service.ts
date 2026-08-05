import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CreateDto, LoginDto } from './auth.dto';
import * as bcrypt from 'bcrypt';
import { UserService } from '../users/user.service';
import { RefreshTokenService } from './refresh-token.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly configService: ConfigService,
  ) {}
  async createTokens(
    userId: number,
    familyId?: string,
  ): Promise<{
    access_token: string;
    refresh_token: string;
  }> {
    const payload = { sub: userId };

    const access_token = this.jwtService.sign(payload);

    const refresh_token = await this.refreshTokenService.createRefreshToken(
      userId,
      familyId,
    );

    return { access_token, refresh_token };
  }

  async createUser(
    body: CreateDto,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const { email, password, name } = body;
    const password_hash = await bcrypt.hash(password, 10);

    const existingUser = await this.userService.getUserByEmail(email);

    if (existingUser) throw new ConflictException('User already exists');

    const user = await this.userService.insertUser(email, password_hash, name);

    const { access_token, refresh_token } = await this.createTokens(
      Number(user.id),
    );

    return { access_token, refresh_token };
  }

  async login(
    body: LoginDto,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const { email, password } = body;
    const user = await this.userService.getUserByEmail(email);

    if (!user) throw new UnauthorizedException('No user found with this email');

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) throw new UnauthorizedException('Password is incorrect');

    const { access_token, refresh_token } = await this.createTokens(user.id);

    return { access_token, refresh_token };
  }

  async logout(refreshToken: string): Promise<void | string> {
    let payload: { id: number; userId: number; family_id: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('jwtService in logout didnt valdate');
    }

    await this.refreshTokenService.deleteToken(payload.family_id);
  }
}
