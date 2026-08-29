import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app';

describe('taskController (e2e)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let ownerAccessToken: string;
  let date: Date;

  beforeAll(async () => {
    ({ app, pool } = await createTestApp());
  });

  beforeEach(async () => {
    await pool.query(
      'TRUNCATE users, workspaces, members, projects, tasks, invitations, files, refresh_tokens RESTART IDENTITY CASCADE',
    );

    const ownerRegester = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'owner@example.com',
        password: 'password123',
        name: 'Owner',
      })
      .expect(201);

    ownerAccessToken = (ownerRegester.body as { access_token: string })
      .access_token;

    await request(app.getHttpServer())
      .post('/workspaces')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ name: 'workspace1' })
      .expect(201);

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

  it('DELETE /workspaces/:workspaceId/projects/:projectId/tasks/:taskId delete task', async () => {
    await request(app.getHttpServer())
      .delete('/workspaces/1/projects/1/tasks/1')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200);
  });

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
});
