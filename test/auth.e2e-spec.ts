import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app';

describe('authController (e2e)', () => {
  let app: INestApplication<App>;
  let pool: Pool;

  beforeAll(async () => {
    ({ app, pool } = await createTestApp());
  });

  beforeEach(async () => {
    await pool.query(
      'TRUNCATE users, workspaces, members, projects, tasks, invitations, files, refresh_tokens RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('registers a new user and returns access_token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'user@example.com',
          password: 'password123',
          name: 'User',
        })
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          access_token: expect.any(String),
        }),
      );

      // refresh_token should be set as an httpOnly cookie
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('returns 409 Conflict when email is already taken', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'password123',
          name: 'First',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'password123',
          name: 'Second',
        })
        .expect(409);
    });

    it('returns 400 Bad Request when email is invalid', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'not-an-email',
          password: 'password123',
          name: 'User',
        })
        .expect(400);
    });

    it('returns 400 Bad Request when password is too short', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'user@example.com',
          password: 'short',
          name: 'User',
        })
        .expect(400);
    });

    it('returns 400 Bad Request when name is missing', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'user@example.com',
          password: 'password123',
        })
        .expect(400);
    });

    it('returns 400 Bad Request when email is missing', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          password: 'password123',
          name: 'User',
        })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'user@example.com',
          password: 'password123',
          name: 'User',
        })
        .expect(201);
    });

    it('logs in with valid credentials and returns access_token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'user@example.com',
          password: 'password123',
        })
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          access_token: expect.any(String),
        }),
      );

      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('returns 401 Unauthorized when password is wrong', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'user@example.com',
          password: 'wrongpassword',
        })
        .expect(401);
    });

    it('returns 401 Unauthorized when email does not exist', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
        .expect(401);
    });

    it('returns 400 Bad Request when email is missing', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          password: 'password123',
        })
        .expect(400);
    });

    it('returns 400 Bad Request when password is missing', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'user@example.com',
        })
        .expect(400);
    });
  });

  describe('POST /auth/refresh', () => {
    let refreshTokenCookie: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'user@example.com',
          password: 'password123',
          name: 'User',
        })
        .expect(201);

      const setCookie = response.headers['set-cookie'] as unknown as string[];
      refreshTokenCookie = setCookie.find((c: string) =>
        c.startsWith('refresh_token='),
      )!;
    });

    it('returns new access_token and rotates refresh_token cookie', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', refreshTokenCookie)
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          access_token: expect.any(String),
        }),
      );

      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('returns 401 Unauthorized when no refresh_token cookie is present', async () => {
      await request(app.getHttpServer()).post('/auth/refresh').expect(401);
    });

    it('returns 401 Unauthorized when refresh_token is invalid', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', 'refresh_token=invalid.token.here')
        .expect(401);
    });

    it('returns 401 Unauthorized when refresh_token is reused (token rotation)', async () => {
      // First refresh — valid, rotates the token
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', refreshTokenCookie)
        .expect(201);

      // Reuse the original token — should be rejected (family revoked)
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', refreshTokenCookie)
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    let refreshTokenCookie: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'user@example.com',
          password: 'password123',
          name: 'User',
        })
        .expect(201);

      const setCookie = response.headers['set-cookie'] as unknown as string[];
      refreshTokenCookie = setCookie.find((c: string) =>
        c.startsWith('refresh_token='),
      )!;
    });

    it('logs out successfully and clears the refresh_token cookie', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', refreshTokenCookie)
        .expect(201);

      const setCookieHeader = response.headers[
        'set-cookie'
      ] as unknown as string[];
      const clearedCookie = setCookieHeader.find((c: string) =>
        c.startsWith('refresh_token='),
      );
      expect(clearedCookie).toBeDefined();
      expect(clearedCookie).toContain('refresh_token=;');
    });

    it('returns 401 Unauthorized when no refresh_token cookie is provided', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(401);
    });
  });
});
