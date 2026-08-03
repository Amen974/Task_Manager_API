import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class UserService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}
  async getUserByEmail(email: string) {
    const user = await this.pool.query<{
      id: number;
      email: string;
      password_hash: string;
      name: string;
      created_at: Date;
    }>(
      'SELECT id, email, password_hash, name, created_at FROM users WHERE email = $1',
      [email],
    );

    return user.rows[0];
  }

  async getUserById(id: number) {
    const user = await this.pool.query<{
      id: number;
      email: string;
      password_hash: string;
      name: string;
      created_at: Date;
    }>(
      'SELECT id, email, password_hash, name, created_at FROM users WHERE id = $1',
      [id],
    );

    return user.rows[0];
  }

  async insertUser(email: string, password_hash: string, name: string) {
    const user = await this.pool.query<{ id: number }>(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id',
      [email, password_hash, name],
    );
    return user.rows[0];
  }
}
