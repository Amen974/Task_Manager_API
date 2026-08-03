import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CreateDto, LoginDto } from './auth.dto';
import * as bcrypt from 'bcrypt';
import { UserService } from '../users/user.service';
import { StringValue } from 'ms';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}
  createTokens(userId: number): {
    access_token: string;
    refresh_token: string;
  } {
    const payload = { sub: userId };

    const access_token = this.jwtService.sign(payload);

    const refresh_token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
      expiresIn: this.configService.get<string>(
        'REFRESH_TOKEN_EXPIRES_IN',
      ) as StringValue,
    });
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

    const { access_token, refresh_token } = this.createTokens(user.id);

    return { access_token, refresh_token };
  }

  async loginUser(
    body: LoginDto,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const { email, password } = body;
    const user = await this.userService.getUserByEmail(email);

    if (!user) throw new UnauthorizedException('No user found with this email');

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) throw new UnauthorizedException('Password is incorrect');

    const { access_token, refresh_token } = this.createTokens(user.id);

    return { access_token, refresh_token };
  }
}
