import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

@Injectable()
export class UserService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findAll(): Promise<Array<Record<string, unknown>>> {
    const result = await this.pool.query('SELECT * FROM users');
    return result.rows as Array<Record<string, unknown>>;
  }
}
