import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app';

describe('storageController (e2e)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let ownerAccessToken: string;
  let memberAccessToken: string;
  let nonMemberAccessToken: string;
  let signedUrl: string;
  let fileId: string;

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

    await request(app.getHttpServer())
      .post('/workspaces/1/projects/1/tasks')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({
        title: 'task1',
        instructions: 'keep it simple',
        assignedTo: 1,
        priority: 'low',
        status: 'pending',
        completedAt: '2026-08-29T14:22:17.483Z',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/workspaces/1/projects/1/tasks/1/store')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ contentType: 'image/png' })
      .expect(201);

    signedUrl = (response.body as { signedUrl: string }).signedUrl;
    fileId = (response.body as { fileId: string }).fileId;
  });

  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  describe('Post workspaces/:workspaceId/projects/:projectId/tasks/:taskId/store', () => {
    it('should return a 201 with signedUrl and fileId', async () => {
      const response = await request(app.getHttpServer())
        .post('/workspaces/1/projects/1/tasks/1/store')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ contentType: 'image/png' })
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          signedUrl: expect.any(String),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          fileId: expect.any(String),
        }),
      );
    });

    it('returns 400 Bad Request when contentType is missing', async () => {
      await request(app.getHttpServer())
        .post('/workspaces/1/projects/1/tasks/1/store')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({})
        .expect(400);
    });

    it('returns 404 Not Found when taskId does not exist', async () => {
      await request(app.getHttpServer())
        .post('/workspaces/1/projects/1/tasks/99999/store')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ contentType: 'image/png' })
        .expect(404);
    });

    it('returns 403 Forbidden when regular member attempts to store upload URL', async () => {
      await request(app.getHttpServer())
        .post('/workspaces/1/projects/1/tasks/1/store')
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .send({ contentType: 'image/png' })
        .expect(403);
    });
  });

  describe('Post workspaces/:workspaceId/projects/:projectId/tasks/:taskId/files/:fileId/confirm', () => {
    it('should confirm upload and return file record', async () => {
      await request(signedUrl)
        .put('')
        .set('Content-Type', 'image/png')
        .send(Buffer.from('fake image content'))
        .expect(200);

      const response = await request(app.getHttpServer())
        .post(`/workspaces/1/projects/1/tasks/1/files/${fileId}/confirm`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ originalName: 'test.png' })
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          id: expect.any(Number),
          fileId: fileId,
        }),
      );
    });

    it('returns 400 Bad Request when file is not uploaded to storage', async () => {
      await request(app.getHttpServer())
        .post(
          '/workspaces/1/projects/1/tasks/1/files/nonexistent-file-id/confirm',
        )
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ originalName: 'fake.png' })
        .expect(400);
    });

    it('returns 400 Bad Request when originalName is missing', async () => {
      await request(app.getHttpServer())
        .post(`/workspaces/1/projects/1/tasks/1/files/${fileId}/confirm`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({})
        .expect(400);
    });

    it('returns 404 Not Found when task does not exist', async () => {
      await request(app.getHttpServer())
        .post(`/workspaces/1/projects/1/tasks/99999/files/${fileId}/confirm`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ originalName: 'test.png' })
        .expect(404);
    });
  });

  describe('Get workspaces/:workspaceId/projects/:projectId/tasks/:taskId/files/:fileId', () => {
    it('should return signedUrl for confirmed file', async () => {
      await request(signedUrl)
        .put('')
        .set('Content-Type', 'image/png')
        .send(Buffer.from('fake image content'))
        .expect(200);

      await request(app.getHttpServer())
        .post(`/workspaces/1/projects/1/tasks/1/files/${fileId}/confirm`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ originalName: 'test.png' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/workspaces/1/projects/1/tasks/1/files/${fileId}`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          signedUrl: expect.any(String),
        }),
      );
    });

    it('returns 404 Not Found when fileId has not been confirmed in database', async () => {
      await request(app.getHttpServer())
        .get('/workspaces/1/projects/1/tasks/1/files/unconfirmed-file-id')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(404);
    });

    it('returns 403 Forbidden when non-member tries to get file', async () => {
      await request(app.getHttpServer())
        .get(`/workspaces/1/projects/1/tasks/1/files/${fileId}`)
        .set('Authorization', `Bearer ${nonMemberAccessToken}`)
        .expect(403);
    });
  });
});
