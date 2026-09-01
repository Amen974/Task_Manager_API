import { Queue } from 'bullmq';
import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { getQueueToken } from '@nestjs/bullmq';
import { createTestApp } from './utils/create-test-app';

describe('invitationController (e2e)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let emailQueue: Queue;
  let ownerAccessToken: string;
  let memberAccessToken: string;
  let invitationToken: string;

  beforeAll(async () => {
    ({ app, pool } = await createTestApp());
    emailQueue = app.get<Queue>(getQueueToken('email'));
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

    await request(app.getHttpServer())
      .post('/workspaces')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ name: 'workspace1' })
      .expect(201);

    const memberRegister = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'member@example.com',
        password: 'password1234',
        name: 'member',
      })
      .expect(201);

    memberAccessToken = (memberRegister.body as { access_token: string })
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
    invitationToken = new URL(acceptUrl).searchParams.get('token')!;

    await request(app.getHttpServer())
      .post('/workspaces/invitations/accept')
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .send({ token: invitationToken })
      .expect(201);
  });

  afterAll(async () => {
    await emailQueue.close();
    await pool.end();
    await app.close();
  });

  describe('POST /workspaces/:workspaceId/invitations', () => {
    it('creates invitation successfully', async () => {
      await request(app.getHttpServer())
        .post('/workspaces/1/invitations')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ email: 'invitee2@example.com' })
        .expect(201);
    });

    it('returns 409 Conflict when invitation already exists for email', async () => {
      await request(app.getHttpServer())
        .post('/workspaces/1/invitations')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ email: 'invitee3@example.com' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/workspaces/1/invitations')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ email: 'invitee3@example.com' })
        .expect(409);
    });

    it('returns 400 Bad Request when invitation email is invalid', async () => {
      await request(app.getHttpServer())
        .post('/workspaces/1/invitations')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ email: 'invalid-email' })
        .expect(400);
    });

    it('returns 403 Forbidden when regular member tries to invite', async () => {
      await request(app.getHttpServer())
        .post('/workspaces/1/invitations')
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .send({ email: 'other@example.com' })
        .expect(403);
    });
  });

  describe('POST /workspaces/invitations/accept', () => {
    it('accepts invitation with valid token', async () => {
      const newUserRegister = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'password123',
          name: 'NewUser',
        })
        .expect(201);

      const newUserToken = (newUserRegister.body as { access_token: string })
        .access_token;

      await request(app.getHttpServer())
        .post('/workspaces/1/invitations')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ email: 'newuser@example.com' })
        .expect(201);

      const jobs = await emailQueue.getJobs(['delayed', 'waiting']);
      const job = jobs.find(
        (j) => (j.data as { email: string }).email === 'newuser@example.com',
      );
      const acceptUrl = (job!.data as { acceptUrl: string }).acceptUrl;
      const token = new URL(acceptUrl).searchParams.get('token')!;

      await request(app.getHttpServer())
        .post('/workspaces/invitations/accept')
        .set('Authorization', `Bearer ${newUserToken}`)
        .send({ token })
        .expect(201);
    });
  });

  describe('POST /workspaces/invitations/decline', () => {
    it('declines invitation with valid token', async () => {
      await request(app.getHttpServer())
        .post('/workspaces/1/invitations')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ email: 'decliner@example.com' })
        .expect(201);

      const jobs = await emailQueue.getJobs(['delayed', 'waiting']);
      const job = jobs.find(
        (j) => (j.data as { email: string }).email === 'decliner@example.com',
      );
      const acceptUrl = (job!.data as { acceptUrl: string }).acceptUrl;
      const declinerToken = new URL(acceptUrl).searchParams.get('token')!;

      await request(app.getHttpServer())
        .post('/workspaces/invitations/decline')
        .send({ token: declinerToken })
        .expect(201);
    });

    it('returns 401 Unauthorized when accepting or declining with invalid token', async () => {
      await request(app.getHttpServer())
        .post('/workspaces/invitations/decline')
        .send({ token: 'invalid.jwt.token' })
        .expect(401);
    });
  });
});
