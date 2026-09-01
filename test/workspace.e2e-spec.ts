import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app';

describe('workspaceController (e2e)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let ownerAccessToken: string;
  let memberAccessToken: string;
  let nonMemberAccessToken: string;

  beforeAll(async () => {
    ({ app, pool } = await createTestApp());
  });

  beforeEach(async () => {
    await pool.query(
      'TRUNCATE users, workspaces, members, projects, tasks, invitations, files, refresh_tokens RESTART IDENTITY CASCADE',
    );

    const ownerRegister = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'owner@example.com',
        password: 'password123',
        name: 'Owner',
      })
      .expect(201);

    ownerAccessToken = (ownerRegister.body as { access_token: string })
      .access_token;

    const memberRegister = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'member@example.com',
        password: 'password123',
        name: 'Member',
      })
      .expect(201);

    memberAccessToken = (memberRegister.body as { access_token: string })
      .access_token;

    const nonMemberRegister = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'nonmember@example.com',
        password: 'password123',
        name: 'NonMember',
      })
      .expect(201);

    nonMemberAccessToken = (nonMemberRegister.body as { access_token: string })
      .access_token;

    await request(app.getHttpServer())
      .post('/workspaces')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ name: 'workspace1' })
      .expect(201);

    await pool.query(
      "INSERT INTO members (workspace_id, member, role) VALUES (1, 2, 'member')",
    );
  });

  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  describe('POST /workspaces', () => {
    it('creates a workspace successfully', async () => {
      await request(app.getHttpServer())
        .post('/workspaces')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ name: 'workspace2' })
        .expect(201);
    });

    it('returns 401 Unauthorized when token is missing', async () => {
      await request(app.getHttpServer())
        .post('/workspaces')
        .send({ name: 'workspaceNoToken' })
        .expect(401);
    });

    it('returns 400 Bad Request when name is missing or empty', async () => {
      await request(app.getHttpServer())
        .post('/workspaces')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ name: '' })
        .expect(400);
    });
  });

  describe('PUT /workspaces/:workspaceId', () => {
    it('PUT /workspaces/:workspaceId update workspace name', async () => {
      await request(app.getHttpServer())
        .put('/workspaces/1')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ name: 'workspaceUpdated' })
        .expect(200);
    });

    it('returns 401 Unauthorized when token is missing', async () => {
      await request(app.getHttpServer())
        .put('/workspaces/1')
        .send({ name: 'workspaceUpdated' })
        .expect(401);
    });

    it('returns 403 Forbidden when regular member attempts to update workspace', async () => {
      await request(app.getHttpServer())
        .put('/workspaces/1')
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .send({ name: 'workspaceUpdatedByMember' })
        .expect(403);
    });

    it('returns 403 Forbidden when non-member attempts to update workspace', async () => {
      await request(app.getHttpServer())
        .put('/workspaces/1')
        .set('Authorization', `Bearer ${nonMemberAccessToken}`)
        .send({ name: 'workspaceUpdatedByNonMember' })
        .expect(403);
    });

    it('returns 403 Forbidden when workspaceId does not exist', async () => {
      await request(app.getHttpServer())
        .put('/workspaces/99999')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ name: 'nonExistent' })
        .expect(403);
    });

    it('returns 400 Bad Request when name is invalid', async () => {
      await request(app.getHttpServer())
        .put('/workspaces/1')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ name: '' })
        .expect(400);
    });
  });

  describe('DELETE /workspaces/:workspaceId', () => {
    it('DELETE /workspaces/:workspaceId', async () => {
      await request(app.getHttpServer())
        .delete('/workspaces/1')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);
    });

    it('returns 403 Forbidden when regular member attempts to delete workspace', async () => {
      await request(app.getHttpServer())
        .delete('/workspaces/1')
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .expect(403);
    });

    it('returns 403 Forbidden when non-member attempts to delete workspace', async () => {
      await request(app.getHttpServer())
        .delete('/workspaces/1')
        .set('Authorization', `Bearer ${nonMemberAccessToken}`)
        .expect(403);
    });

    it('returns 403 Forbidden when workspaceId does not exist', async () => {
      await request(app.getHttpServer())
        .delete('/workspaces/99999')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(403);
    });
  });

  describe('GET /workspaces', () => {
    it('GET /workspaces', async () => {
      const response = await request(app.getHttpServer())
        .get('/workspaces')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'workspace1',
            createdBy: 1,
          }),
        ]),
      );
    });

    it('supports query parameters (search, pagination, sort)', async () => {
      const response = await request(app.getHttpServer())
        .get(
          '/workspaces?search=workspace1&page=1&sortBy=createdAt&sortOrder=desc',
        )
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
    });

    it('returns 401 Unauthorized when token is missing', async () => {
      await request(app.getHttpServer()).get('/workspaces').expect(401);
    });
  });
});
