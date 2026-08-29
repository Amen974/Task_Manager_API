import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../database/pg-pool.token';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ProjectCreatedEvent,
  ProjectDeletedEvent,
  ProjectUpdatedEvent,
} from '../../realtime/events.event';
import { SortBy, SortOrder } from '../../types/workspace.types';

@Injectable()
export class ProjectService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private eventEmitter: EventEmitter2,
  ) {}

  async createProject(
    workspaceId: number,
    body: { name: string },
  ): Promise<void> {
    const createdAt = new Date();
    const projectEvent = await this.pool.query<{
      name: string;
      createdAt: Date;
      updatedAt: Date;
    }>(
      'INSERT INTO projects (name, workspace_id) VALUES ($1, $2) RETURNING name, created_at AS "createdAt", updated_at AS "updatedAt"',
      [body.name, workspaceId],
    );

    this.eventEmitter.emit(
      'project.created',
      new ProjectCreatedEvent(workspaceId, projectEvent.rows[0], createdAt),
    );
  }

  async updateProject(
    workspaceId: number,
    projectId: number,
    body: { name: string },
  ): Promise<{ name: string; updatedAt: Date }> {
    const project = await this.pool.query<{ id: number }>(
      'SELECT id FROM projects WHERE id = $1 AND workspace_id = $2',
      [projectId, workspaceId],
    );

    if (project.rows.length === 0) {
      throw new NotFoundException('Project not found in this workspace');
    }

    const updatedAt = new Date();
    const projectEvent = await this.pool.query<{
      name: string;
      updatedAt: Date;
    }>(
      'UPDATE projects SET name = $1, updated_at = $2 WHERE id = $3 RETURNING name, updated_at AS "updatedAt"',
      [body.name, updatedAt, projectId],
    );

    this.eventEmitter.emit(
      'project.updated',
      new ProjectUpdatedEvent(workspaceId, projectEvent.rows[0], updatedAt),
    );

    return projectEvent.rows[0];
  }

  async deleteProject(workspaceId: number, projectId: number): Promise<void> {
    const project = await this.pool.query<{ id: number }>(
      'SELECT id FROM projects WHERE id = $1 AND workspace_id = $2',
      [projectId, workspaceId],
    );

    if (project.rows.length === 0) {
      throw new NotFoundException('Project not found in this workspace');
    }

    await this.pool.query('DELETE FROM projects WHERE id = $1', [projectId]);

    this.eventEmitter.emit(
      'project.deleted',
      new ProjectDeletedEvent(workspaceId, projectId),
    );
  }

  async getProject(
    workspaceId: number,
    page: number,
    search?: string,
    sortBy?: SortBy,
    sortOrder?: SortOrder,
  ): Promise<
    Array<{
      name: string;
      createdAt: Date;
      updatedAt: Date;
    }>
  > {
    const offset = (page - 1) * 20;

    const sortColumns: Record<string, string> = {
      createdAt: 'p.created_at',
      updatedAt: 'p.updated_at',
    };

    const column = sortColumns[sortBy ?? 'createdAt'];
    const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const result = await this.pool.query<{
      name: string;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `SELECT
       p.name AS "name",
       p.created_at AS "createdAt",
       p.updated_at AS "updatedAt"
       FROM projects p
       JOIN workspaces w ON w.id = p.workspace_id
       WHERE w.id = $1
       AND ($2 = '' OR p.name ILIKE '%' || $2 || '%')
       ORDER BY ${column} ${direction}
       LIMIT 20
       OFFSET $3`,
      [workspaceId, search ?? '', offset],
    );

    return result.rows;
  }
}
