import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app';

describe('projectController (e2e)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let ownerAccessToken: string;

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
  });

  afterAll(async () => {
    await pool.end();
    await app.close();
  });

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

  it('DELETE /workspaces/:workspaceId/projects/:projectId delete project', async () => {
    await request(app.getHttpServer())
      .delete('/workspaces/1/projects/1')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200);
  });

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
});
