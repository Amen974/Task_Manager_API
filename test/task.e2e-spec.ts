import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app';

describe('taskController (e2e)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let ownerAccessToken: string;
  let memberAccessToken: string;
  let nonMemberAccessToken: string;
  let date: Date;

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

    date = new Date();
  });

  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  describe('POST /workspaces/:workspaceId/projects/:projectId/tasks', () => {
    it('creates a task and returns it', async () => {
      const response = await request(app.getHttpServer())
        .post('/workspaces/1/projects/1/tasks')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ title: 'task2', priority: 'low', status: 'pending' })
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          title: 'task2',
          priority: 'low',
          status: 'pending',
          instructions: null,
          assignedTo: null,
          completedAt: null,
        }),
      );
    });

    it('returns 400 when title is missing', async () => {
      await request(app.getHttpServer())
        .post('/workspaces/1/projects/1/tasks')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ priority: 'low', status: 'pending' })
        .expect(400);
    });

    it('returns 400 when priority is not a valid enum value', async () => {
      await request(app.getHttpServer())
        .post('/workspaces/1/projects/1/tasks')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ title: 'task2', priority: 'urgent-ish', status: 'pending' })
        .expect(400);
    });

    it('returns 404 when project does not exist', async () => {
      await request(app.getHttpServer())
        .post('/workspaces/1/projects/99999/tasks')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ title: 'taskOrphan', priority: 'low', status: 'pending' })
        .expect(404);
    });

    it('returns 403 Forbidden when non-workspace-member tries to create task', async () => {
      await request(app.getHttpServer())
        .post('/workspaces/1/projects/1/tasks')
        .set('Authorization', `Bearer ${nonMemberAccessToken}`)
        .send({ title: 'unauthTask', priority: 'low', status: 'pending' })
        .expect(403);
    });
  });

  describe('PUT /workspaces/:workspaceId/projects/:projectId/tasks/:taskId', () => {
    it('PUT /workspaces/:workspaceId/projects/:projectId/tasks/:taskId changes title from task1 to taskUpdated', async () => {
      const response = await request(app.getHttpServer())
        .put('/workspaces/1/projects/1/tasks/1')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          title: 'taskUpdated',
          instructions: 'keep it simple',
          assignedTo: 1,
          priority: 'low',
          status: 'pending',
          completedAt: date,
        })
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          title: 'taskUpdated',
          instructions: 'keep it simple',
          assignedTo: 1,
          priority: 'low',
          status: 'pending',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          completedAt: expect.any(String),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          updatedAt: expect.any(String),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          createdAt: expect.any(String),
        }),
      );
    });

    it('returns 404 when taskId doesnt exist', async () => {
      await request(app.getHttpServer())
        .put('/workspaces/1/projects/1/tasks/555')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ priority: 'low', status: 'pending' })
        .expect(404);
    });

    it('returns 400 when priority is not a valid enum value', async () => {
      await request(app.getHttpServer())
        .put('/workspaces/1/projects/1/tasks/1')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ priority: 'wrong', status: 'pending' })
        .expect(400);
    });

    it('returns 400 when body has no fields to update', async () => {
      await request(app.getHttpServer())
        .put('/workspaces/1/projects/1/tasks/1')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({})
        .expect(400);
    });

    it('returns 403 Forbidden when regular member tries to update a task assigned to someone else', async () => {
      // task1 is assigned to user 1 (owner). Member is user 2.
      await request(app.getHttpServer())
        .put('/workspaces/1/projects/1/tasks/1')
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .send({ title: 'unauthorizedUpdate' })
        .expect(403);
    });
  });

  describe('DELETE /workspaces/:workspaceId/projects/:projectId/tasks/:taskId', () => {
    it('DELETE /workspaces/:workspaceId/projects/:projectId/tasks/:taskId delete task', async () => {
      await request(app.getHttpServer())
        .delete('/workspaces/1/projects/1/tasks/1')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);
    });

    it('returns 404 Not Found when task to delete does not exist', async () => {
      await request(app.getHttpServer())
        .delete('/workspaces/1/projects/1/tasks/99999')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(404);
    });
  });

  describe('GET /workspaces/:workspaceId/projects/:projectId/tasks', () => {
    it('Get /workspaces/:workspaceId/project/:projectId/tasks get tasks', async () => {
      const response = await request(app.getHttpServer())
        .get('/workspaces/1/projects/1/tasks')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: 'task1',
            instructions: 'keep it simple',
            assignedTo: 1,
            priority: 'low',
            status: 'pending',
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            completedAt: expect.any(String),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            createdAt: expect.any(String),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            updatedAt: expect.any(String),
          }),
        ]),
      );
    });

    it('supports status, priority, search, and pagination filters', async () => {
      const response = await request(app.getHttpServer())
        .get(
          '/workspaces/1/projects/1/tasks?status=pending&priority=low&search=task1&page=1',
        )
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
    });

    it('returns 403 Forbidden when non-member tries to get tasks', async () => {
      await request(app.getHttpServer())
        .get('/workspaces/1/projects/1/tasks')
        .set('Authorization', `Bearer ${nonMemberAccessToken}`)
        .expect(403);
    });
  });
});
