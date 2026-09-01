import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { PG_POOL } from '../database/pg-pool.token';

@Injectable()
export class StorageService {
  constructor(
    private readonly config: ConfigService,
    @Inject('B2_CLIENT') private readonly b2Client: S3Client,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  async createUploadUrl(
    contentType: string,
    workspaceId: number,
    projectId: number,
    taskId: number,
  ): Promise<{ signedUrl: string; fileId: string }> {
    const task = await this.pool.query<{ id: number }>(
      `SELECT t.id
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       WHERE t.id = $1 AND p.id = $2 AND p.workspace_id = $3`,
      [taskId, projectId, workspaceId],
    );

    if (task.rows.length === 0) {
      throw new NotFoundException('Task not found in this project');
    }

    const fileId = randomUUID();

    const key = `workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/files/${fileId}`;

    const command = new PutObjectCommand({
      Bucket: this.config.getOrThrow<string>('B2_BUCKET_NAME'),
      Key: key,
      ContentType: contentType,
    });

    const signedUrl = await getSignedUrl(this.b2Client, command, {
      expiresIn: 900,
    });

    return { signedUrl, fileId };
  }

  async confirmUpload(
    workspaceId: number,
    projectId: number,
    taskId: number,
    fileId: string,
    originalName: string,
    userId: number,
  ): Promise<{ id: number; fileId: string }> {
    const task = await this.pool.query<{ id: number }>(
      `SELECT t.id
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       WHERE t.id = $1 AND p.id = $2 AND p.workspace_id = $3`,
      [taskId, projectId, workspaceId],
    );

    if (task.rows.length === 0) {
      throw new NotFoundException('Task not found in this project');
    }

    const storageKey = `workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/files/${fileId}`;
    let object;

    try {
      object = await this.b2Client.send(
        new HeadObjectCommand({
          Bucket: this.config.getOrThrow<string>('B2_BUCKET_NAME'),
          Key: storageKey,
        }),
      );
    } catch {
      throw new BadRequestException('Uploaded file was not found in storage');
    }

    if (object.ContentLength === undefined || !object.ContentType) {
      throw new BadRequestException('Stored file metadata is incomplete');
    }

    const inserted = await this.pool.query<{ id: number }>(
      `INSERT INTO files
         (task_id, storage_key, original_name, content_type, size, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (storage_key) DO NOTHING
       RETURNING id`,
      [
        taskId,
        storageKey,
        originalName,
        object.ContentType,
        object.ContentLength,
        userId,
      ],
    );

    if (inserted.rows.length > 0) {
      return { id: inserted.rows[0].id, fileId };
    }

    const existing = await this.pool.query<{ id: number }>(
      'SELECT id FROM files WHERE storage_key = $1',
      [storageKey],
    );

    return { id: existing.rows[0].id, fileId };
  }

  async getFile(
    workspaceId: number,
    projectId: number,
    taskId: number,
    fileId: string,
  ): Promise<{ signedUrl: string }> {
    const storageKey = `workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/files/${fileId}`;

    const file = await this.pool.query<{ storage_key: string }>(
      `SELECT f.storage_key
       FROM files f
       JOIN tasks t ON t.id = f.task_id
       JOIN projects p ON p.id = t.project_id
       WHERE f.storage_key = $1
         AND t.id = $2
         AND p.id = $3
         AND p.workspace_id = $4`,
      [storageKey, taskId, projectId, workspaceId],
    );

    if (file.rows.length === 0) {
      throw new NotFoundException('File not found in this task');
    }

    const command = new GetObjectCommand({
      Bucket: this.config.getOrThrow<string>('B2_BUCKET_NAME'),
      Key: file.rows[0].storage_key,
    });

    const signedUrl = await getSignedUrl(this.b2Client, command, {
      expiresIn: 900,
    });

    return { signedUrl };
  }
}
