import { Body, Controller, Get, Post } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async getUserByEmail(@Body('email') email: string) {
    return this.userService.getUserByEmail(email);
  }

  @Get()
  async getUserById(@Body('id') id: number) {
    return this.userService.getUserById(id);
  }

  @Post()
  async insertUser(
    @Body()
    {
      email,
      password_hash,
      name,
    }: {
      email: string;
      password_hash: string;
      name: string;
    },
  ) {
    return this.userService.insertUser(email, password_hash, name);
  }
}
