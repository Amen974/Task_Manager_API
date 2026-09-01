import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app';

describe('projectController (e2e)', () => {
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

    await request(app.getHttpServer())
      .post('/workspaces/1/projects')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ name: 'project1' })
      .expect(201);
  });

  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  describe('POST /workspaces/:workspaceId/projects', () => {
    it('creates project successfully for owner/admin', async () => {
      await request(app.getHttpServer())
        .post('/workspaces/1/projects')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ name: 'project2' })
        .expect(201);
    });

    it('returns 400 Bad Request when name is missing', async () => {
      await request(app.getHttpServer())
        .post('/workspaces/1/projects')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ name: '' })
        .expect(400);
    });

    it('returns 403 Forbidden when regular member tries to create project', async () => {
      await request(app.getHttpServer())
        .post('/workspaces/1/projects')
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .send({ name: 'memberProject' })
        .expect(403);
    });

    it('returns 403 Forbidden when non-member tries to create project', async () => {
      await request(app.getHttpServer())
        .post('/workspaces/1/projects')
        .set('Authorization', `Bearer ${nonMemberAccessToken}`)
        .send({ name: 'nonMemberProject' })
        .expect(403);
    });
  });

  describe('PUT /workspaces/:workspaceId/projects/:projectId', () => {
    it('PUT /workspaces/:workspaceId/projects/:projectId changes name from project1 to projectUpdated', async () => {
      const response = await request(app.getHttpServer())
        .put('/workspaces/1/projects/1')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ name: 'projectUpdated' })
        .expect(200);

      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      expect(response.body).toEqual(
        expect.objectContaining({
          name: 'projectUpdated',
          updatedAt: expect.any(String),
        }),
      );
    });

    it('returns 404 Not Found when projectId does not exist', async () => {
      await request(app.getHttpServer())
        .put('/workspaces/1/projects/99999')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ name: 'projectUpdated' })
        .expect(404);
    });

    it('returns 400 Bad Request when name is invalid', async () => {
      await request(app.getHttpServer())
        .put('/workspaces/1/projects/1')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ name: '' })
        .expect(400);
    });

    it('returns 403 Forbidden when regular member tries to update project', async () => {
      await request(app.getHttpServer())
        .put('/workspaces/1/projects/1')
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .send({ name: 'projectUpdatedByMember' })
        .expect(403);
    });
  });

  describe('DELETE /workspaces/:workspaceId/projects/:projectId', () => {
    it('DELETE /workspaces/:workspaceId/projects/:projectId delete project', async () => {
      await request(app.getHttpServer())
        .delete('/workspaces/1/projects/1')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);
    });

    it('returns 404 Not Found when projectId does not exist', async () => {
      await request(app.getHttpServer())
        .delete('/workspaces/1/projects/99999')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(404);
    });

    it('returns 403 Forbidden when regular member tries to delete project', async () => {
      await request(app.getHttpServer())
        .delete('/workspaces/1/projects/1')
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .expect(403);
    });
  });

  describe('GET /workspaces/:workspaceId/projects', () => {
    it('Get /workspaces/:workspaceId get projects', async () => {
      const response = await request(app.getHttpServer())
        .get('/workspaces/1/projects')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'project1',
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          }),
        ]),
      );
    });

    it('supports search query filter and pagination', async () => {
      const response = await request(app.getHttpServer())
        .get(
          '/workspaces/1/projects?search=project1&page=1&sortBy=createdAt&sortOrder=asc',
        )
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
    });

    it('returns 403 Forbidden when non-member tries to get projects', async () => {
      await request(app.getHttpServer())
        .get('/workspaces/1/projects')
        .set('Authorization', `Bearer ${nonMemberAccessToken}`)
        .expect(403);
    });
  });
});
