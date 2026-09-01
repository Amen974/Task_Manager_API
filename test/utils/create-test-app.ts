import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { Pool } from 'pg';
import { PG_POOL } from '../../src/database/pg-pool.token';
import { AppModule } from '../../src/app.module';
import { EmailService } from '../../src/email/email.service';

export async function createTestApp(): Promise<{
  app: INestApplication;
  pool: Pool;
}> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(EmailService)
    .useValue({
      sendEmail: jest.fn().mockResolvedValue(undefined),
      sendInvitationEmail: jest.fn().mockResolvedValue(undefined),
    })
    .compile();

  const app = moduleFixture.createNestApplication();

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const pool = moduleFixture.get<Pool>(PG_POOL);

  await app.init();
  return { app, pool };
}
