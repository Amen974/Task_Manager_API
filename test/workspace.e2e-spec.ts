import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app';

describe('workspaceController (e2e)', () => {
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
  });

  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  it('PUT /workspaces/:workspaceId update workspace name', async () => {
    await request(app.getHttpServer())
      .put('/workspaces/1')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ name: 'workspaceUpdated' })
      .expect(200);
  });

  it('DELETE /workspaces/:workspaceId', async () => {
    await request(app.getHttpServer())
      .delete('/workspaces/1')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200);
  });

  it('GET /workspaces', async () => {
    await request(app.getHttpServer())
      .get('/workspaces')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200);
  });
});
