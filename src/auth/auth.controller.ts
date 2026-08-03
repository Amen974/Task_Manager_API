import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto, LoginUserDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Post('register')
  async createUser(
    @Body() body: CreateUserDto,
  ): Promise<{ access_token: string; refresh_token: string }> {
    return this.authService.createUser(body);
  }

  @Post('login')
  async loginUser(
    @Body() body: LoginUserDto,
  ): Promise<{ access_token: string; refresh_token: string }> {
    return this.authService.loginUser(body);
  }
}
