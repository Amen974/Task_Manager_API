import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { StringValue } from 'ms';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

@Injectable()
export class RefreshTokenService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  expiresIn(): Date {
    const expires = this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN')!;

    const days = Number(expires.slice(0, -1));

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    return expiresAt;
  }

  async addRefreshTokenToDb(
    userId: number,
    refreshToken: string,
    familyId?: string,
  ): Promise<void> {
    const hashToken = await bcrypt.hash(refreshToken, 10);
    const expiresAt = this.expiresIn();

    await this.pool.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at) VALUES ($1, $2, $3, $4)',
      [userId, hashToken, familyId, expiresAt],
    );
  }

  async createRefreshToken(userId: number, familyId?: string): Promise<string> {
    const resolvedFamilyId = familyId ?? randomUUID();
    const payload = { sub: userId, family_id: resolvedFamilyId };
    if (familyId) await this.markRefreshTokenAsUsed(familyId);

    const refresh_token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
      expiresIn: this.configService.get<string>(
        'REFRESH_TOKEN_EXPIRES_IN',
      ) as StringValue,
    });

    await this.addRefreshTokenToDb(userId, refresh_token, resolvedFamilyId);
    return refresh_token;
  }

  async markRefreshTokenAsUsed(familyId: string): Promise<void> {
    await this.pool.query(
      'UPDATE refresh_tokens SET used = true WHERE family_id = $1',
      [familyId],
    );
  }

  async isUsedRefreshToken(
    hashToken: string,
    userId: number,
  ): Promise<boolean> {
    const result = await this.pool.query<{ used: boolean }>(
      'SELECT used FROM refresh_tokens WHERE token_hash = $1 AND user_id = $2',
      [hashToken, userId],
    );

    if (result.rowCount === 0) throw new UnauthorizedException();

    return result.rows[0].used;
  }

  async revokeTokenFamily(familyId: string): Promise<void> {
    await this.pool.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE family_id = $1',
      [familyId],
    );
  }

  async isRevokedToken(familyId: string): Promise<boolean> {
    const result = await this.pool.query<{ revoked_at: Date | null }>(
      'SELECT revoked_at FROM refresh_tokens WHERE family_id = $1',
      [familyId],
    );

    if (result.rowCount === 0) return false;

    return result.rows[0].revoked_at !== null;
  }

  async getHashToken(userId: number, familyId: string): Promise<string> {
    const hashToken = await this.pool.query<{ token_hash: string }>(
      'SELECT token_hash FROM refresh_tokens WHERE user_id = $1 AND family_id = $2',
      [userId, familyId],
    );

    if (hashToken.rowCount === 0) throw new UnauthorizedException();

    return hashToken.rows[0].token_hash;
  }

  async deleteToken(familyId: string): Promise<void> {
    await this.pool.query('DELETE FROM refresh_tokens WHERE family_id = $1', [
      familyId,
    ]);
  }

  async validateRefreshToken(
    refreshToken: string,
  ): Promise<{ userId: number; familyId: string; message?: string }> {
    let message: string | undefined;
    let payload: { sub: number; family_id: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
      });
    } catch {
      throw new UnauthorizedException((message = 'invalid token'));
    }

    const hashToken = await this.getHashToken(payload.sub, payload.family_id);

    const existToken = await bcrypt.compare(refreshToken, hashToken);
    if (!existToken) throw new ConflictException((message = 'invalid token'));

    const isUsed = await this.isUsedRefreshToken(hashToken, payload.sub);
    if (isUsed) {
      await this.revokeTokenFamily(payload.family_id);
      throw new UnauthorizedException((message = 'refresh token already used'));
    }

    const revoked = await this.isRevokedToken(payload.family_id);
    if (revoked)
      throw new UnauthorizedException((message = 'refresh token revoked'));

    return { userId: payload.sub, familyId: payload.family_id, message };
  }
}
