import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
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

  async reserveTokenRow(userId: number, familyId: string): Promise<number> {
    const expiresAt = this.expiresIn();

    const result = await this.pool.query<{ id: number }>(
      'INSERT INTO refresh_tokens (user_id, family_id, expires_at) VALUES ($1, $2, $3) RETURNING id',
      [userId, familyId, expiresAt],
    );

    return result.rows[0].id;
  }

  async setTokenHash(id: number, refreshToken: string): Promise<void> {
    const hashToken = await bcrypt.hash(refreshToken, 10);

    await this.pool.query(
      'UPDATE refresh_tokens SET token_hash = $1 WHERE id = $2',
      [hashToken, id],
    );
  }

  async createRefreshToken(userId: number, familyId?: string): Promise<string> {
    const resolvedFamilyId = familyId ?? randomUUID();

    const id = await this.reserveTokenRow(userId, resolvedFamilyId);

    const payload = { id, userId: Number(userId), family_id: resolvedFamilyId };
    const refresh_token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
      expiresIn: this.configService.get<string>(
        'REFRESH_TOKEN_EXPIRES_IN',
      ) as StringValue,
    });

    await this.setTokenHash(id, refresh_token);
    return refresh_token;
  }

  async getTokenRow(id: number): Promise<{
    user_id: number;
    family_id: string;
    token_hash: string;
    used: boolean;
    expires_at: Date;
  }> {
    const result = await this.pool.query<{
      user_id: number;
      family_id: string;
      token_hash: string;
      used: boolean;
      expires_at: Date;
    }>(
      'SELECT user_id, family_id, token_hash, used, expires_at FROM refresh_tokens WHERE id = $1',
      [id],
    );

    if (result.rowCount === 0)
      throw new UnauthorizedException('refresh token not found');

    return result.rows[0];
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

  async deleteToken(familyId: string): Promise<void> {
    await this.pool.query('DELETE FROM refresh_tokens WHERE family_id = $1', [
      familyId,
    ]);
  }

  async markRefreshTokenAsUsed(id: number): Promise<void> {
    await this.pool.query(
      'UPDATE refresh_tokens SET used = true WHERE id = $1',
      [id],
    );
  }

  async validateRefreshToken(
    refreshToken: string,
  ): Promise<{ userId: number; familyId: string }> {
    let payload: { id: number; userId: number; family_id: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('invalid token in jwtService.verify');
    }

    console.log('refresh req token: ', refreshToken);
    console.log('refresh req token id: ', payload.id);

    const tokenRow = await this.getTokenRow(payload.id);

    console.log('tokenRow hash : ', tokenRow.token_hash);
    console.log('tokenRow state: ', tokenRow.used);

    if (
      tokenRow.user_id !== payload.userId ||
      tokenRow.family_id !== payload.family_id
    ) {
      throw new UnauthorizedException('invalid token in tokenRow');
    }

    const matches = await bcrypt.compare(refreshToken, tokenRow.token_hash);
    if (!matches)
      throw new UnauthorizedException('invalid token in bcrypt.compare');

    const revoked = await this.isRevokedToken(payload.family_id);
    if (revoked) throw new UnauthorizedException('refresh token revoked');

    if (tokenRow.expires_at.getTime() < Date.now()) {
      throw new UnauthorizedException('refresh token expired');
    }

    if (tokenRow.used) {
      await this.revokeTokenFamily(payload.family_id);
      throw new UnauthorizedException('refresh token already used');
    }

    await this.markRefreshTokenAsUsed(payload.id);

    return { userId: payload.userId, familyId: payload.family_id };
  }
}
