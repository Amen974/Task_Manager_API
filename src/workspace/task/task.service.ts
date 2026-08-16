import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../database/pg-pool.token';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  TaskCreatedEvent,
  TaskDeletedEvent,
  TaskUpdatedEvent,
} from '../../realtime/events.event';
import {
  CreateTask,
  Priority,
  SortBy,
  SortOrder,
  Status,
  UpdateTaskDto,
} from '../workspace.dto';
import { MemberService } from '../member/member.service';

@Injectable()
export class TaskService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private eventEmitter: EventEmitter2,
    private readonly memberService: MemberService,
  ) {}

  async createTask(
    workspaceId: number,
    projectId: number,
    body: CreateTask,
  ): Promise<void> {
    const {
      title,
      instructions,
      assigned_to: assignedTo,
      priority,
      status,
      completedAt,
    } = body;

    const project = await this.pool.query<{ id: number }>(
      'SELECT id FROM projects WHERE id = $1 AND workspace_id = $2',
      [projectId, workspaceId],
    );

    if (project.rows.length === 0) {
      throw new NotFoundException('Project not found in this workspace');
    }

    const createdAt = new Date();
    const taskEvent = await this.pool.query<{
      title: string;
      instructions: string | null;
      assignedTo: number | null;
      priority: string;
      status: string;
      completedAt: Date | null;
    }>(
      `INSERT INTO tasks (project_id, title, instructions, assigned_to, priority, status, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING title, instructions, assigned_to AS "assignedTo", priority, status, completed_at AS "completedAt"`,
      [
        projectId,
        title,
        instructions,
        assignedTo,
        priority,
        status,
        completedAt,
      ],
    );

    this.eventEmitter.emit(
      'task.created',
      new TaskCreatedEvent(workspaceId, taskEvent.rows[0], createdAt),
    );
  }

  async updateTask(
    userId: number,
    workspaceId: number,
    taskId: number,
    body: UpdateTaskDto,
  ): Promise<void> {
    const task = await this.pool.query<{
      id: number;
      assigned_to: number | null;
    }>(
      `SELECT t.id, t.assigned_to
         FROM tasks t
         JOIN projects p ON p.id = t.project_id
         WHERE t.id = $1 AND p.workspace_id = $2`,
      [taskId, workspaceId],
    );

    if (task.rows.length === 0) {
      throw new NotFoundException('Task not found in this workspace');
    }

    const userRole = await this.memberService.getMemberRole(
      workspaceId,
      userId,
    );

    if (userRole === 'member' && task.rows[0].assigned_to !== userId) {
      throw new ForbiddenException(
        'Members can only update tasks assigned to themselves',
      );
    }

    const fields: string[] = [];
    const values: unknown[] = [];

    if (body.title !== undefined) {
      fields.push('title = $1');
      values.push(body.title);
    }

    if (body.instructions !== undefined) {
      fields.push(`instructions = $${values.length + 1}`);
      values.push(body.instructions);
    }

    if (body.assigned_to !== undefined) {
      fields.push(`assigned_to = $${values.length + 1}`);
      values.push(body.assigned_to);
    }

    if (body.priority !== undefined) {
      fields.push(`priority = $${values.length + 1}`);
      values.push(body.priority);
    }

    if (body.status !== undefined) {
      fields.push(`status = $${values.length + 1}`);
      values.push(body.status);
    }

    if (body.completedAt !== undefined) {
      fields.push(`completed_at = $${values.length + 1}`);
      values.push(body.completedAt);
    }

    if (fields.length === 0) {
      throw new BadRequestException('No fields provided to update');
    }

    values.push(taskId);

    const updatedAt = new Date();
    values.push(updatedAt);

    const taskEvent = await this.pool.query<{
      title: string;
      instructions: string | null;
      assignedTo: number | null;
      priority: string;
      status: string;
      completedAt: Date | null;
    }>(
      `UPDATE tasks SET ${fields.join(', ')} updated_at = ${values.length} WHERE id = $${values.length - 1} 
        RETURNING title, instructions, assigned_to AS "assignedTo", priority, status, completed_at AS "completedAt"`,
      values,
    );

    this.eventEmitter.emit(
      'task.updated',
      new TaskUpdatedEvent(workspaceId, taskEvent.rows[0], updatedAt),
    );
  }

  async deleteTask(workspaceId: number, taskId: number): Promise<void> {
    const task = await this.pool.query<{ id: number }>(
      `SELECT t.id
         FROM tasks t
         JOIN projects p ON p.id = t.project_id
         WHERE t.id = $1 AND p.workspace_id = $2`,
      [taskId, workspaceId],
    );

    if (task.rows.length === 0) {
      throw new NotFoundException('Task not found in this workspace');
    }

    await this.pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);

    this.eventEmitter.emit(
      'task.delete',
      new TaskDeletedEvent(workspaceId, taskId),
    );
  }

  async getTask(
    workspaceId: number,
    projectId: number,
    page: number,
    status?: Status,
    assignedTo?: number,
    priority?: Priority,
    sortBy?: SortBy,
    sortOrder?: SortOrder,
    search?: string,
  ): Promise<
    Array<{
      title: string;
      instructions: string | null;
      assignedTo: number | null;
      priority: Priority;
      status: Status;
      createdAt: Date;
      completedAt: Date | null;
      updatedAt: Date;
    }>
  > {
    const offset = (page - 1) * 20;
    const values: unknown[] = [workspaceId, projectId];
    const sortColumns: Record<string, string> = {
      createdAt: 't.created_at',
      updatedAt: 't.updated_at',
      priority: 't.priority',
      title: 't.title',
      status: 't.status',
    };
    const column = sortColumns[sortBy ?? 'createdAt'];
    const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
    let query = `
      SELECT
        t.title AS "title",
        t.instructions AS "instructions",
        t.assigned_to AS "assignedTo",
        t.priority AS "priority",
        t.status AS "status",
        t.created_at AS "createdAt",
        t.completed_at AS "completedAt",
        t.updated_at AS "updatedAt"
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE p.workspace_id = $1 AND t.project_id = $2
    `;

    if (status !== undefined) {
      values.push(status);
      query += `AND t.status = $${values.length} `;
    }

    if (assignedTo !== undefined) {
      values.push(assignedTo);
      query += `AND t.assigned_to = $${values.length} `;
    }

    if (priority !== undefined) {
      values.push(priority);
      query += `AND t.priority = $${values.length} `;
    }

    values.push(search ?? '');
    query += `AND ($${values.length} = '' OR t.title ILIKE '%' || $${values.length} || '%') `;

    values.push(column, direction);
    query += `ORDER BY ${column} ${direction} `;

    values.push(offset);
    query += `LIMIT 20 OFFSET $${values.length}`;

    const result = await this.pool.query<{
      title: string;
      instructions: string | null;
      assignedTo: number | null;
      priority: Priority;
      status: Status;
      createdAt: Date;
      completedAt: Date | null;
      updatedAt: Date;
    }>(query, values);

    return result.rows;
  }
}
