import { Body, Controller, Get, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { EmailDto, GetUserByIdDto } from './user.dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async getUserByEmail(@Body() dto: EmailDto) {
    return this.userService.getUserByEmail(dto.email);
  }

  @Get()
  async getUserById(@Body() dto: GetUserByIdDto) {
    return this.userService.getUserById(dto.id);
  }

  @Post()
  async insertUser(@Body() dto: EmailDto) {
    return this.userService.insertUser(dto.email, dto.password_hash, dto.name);
  }
}
