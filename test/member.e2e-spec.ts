import { Queue } from 'bullmq';
import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { getQueueToken } from '@nestjs/bullmq';
import { createTestApp } from './utils/create-test-app';

describe('memberController (e2e)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let emailQueue: Queue;
  let ownerAccessToken: string;

  beforeAll(async () => {
    ({ app, pool } = await createTestApp());
    emailQueue = app.get<Queue>(getQueueToken('email'));
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

    const member = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'member@example.com',
        password: 'password1234',
        name: 'member',
      })
      .expect(201);

    const memberAccessToken = (member.body as { access_token: string })
      .access_token;

    await request(app.getHttpServer())
      .post('/workspaces/1/invitations')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ email: 'member@example.com' })
      .expect(201);

    const jobs = await emailQueue.getJobs(['delayed', 'waiting']);

    const job = jobs.find(
      (j) => (j.data as { email: string }).email === 'member@example.com',
    );

    if (!job) throw new Error('Invitation email job not found');

    const acceptUrl = (job.data as { acceptUrl: string }).acceptUrl;
    const token = new URL(acceptUrl).searchParams.get('token');

    await request(app.getHttpServer())
      .post('/workspaces/invitations/accept')
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .send({ token })
      .expect(201);
  });

  afterAll(async () => {
    await emailQueue.close();
    await pool.end();
    await app.close();
  });

  it('DELETE /workspaces/:workspaceId/members/:memberId removes a member', async () => {
    await request(app.getHttpServer())
      .delete('/workspaces/1/members/2')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200);
  });

  it('PUT /workspaces/:workspaceId/members/:memberId/role changes a member role', async () => {
    await request(app.getHttpServer())
      .put('/workspaces/1/members/2/role')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ role: 'admin' })
      .expect(200);
  });
});
