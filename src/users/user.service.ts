import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}
  async createUser(body: CreateUserDto): Promise<{ message: string }> {
    const { email, password, name } = body;
    const hashPassword = await bcrypt.hash(password, 10);
    const existingUser = await this.pool.query(
      'SELECT email FROM users WHERE email = $1',
      [email],
    );
    if (existingUser.rows.length > 0)
      throw new ConflictException('User already exists');
    await this.pool.query(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3)',
      [email, hashPassword, name],
    );
    return { message: `User ${name} created successfully` };
  }
}
