import { PG_POOL } from '../database/database.module';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateTask,
  Priority,
  Role,
  SortBy,
  SortOrder,
  Status,
  UpdateTaskDto,
} from './workspace.dto';
import { Pool, PoolClient } from 'pg';
import { TransactionService } from '../database/Transaction.service';

@Injectable()
export class WorkspaceService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly transactionService: TransactionService,
  ) {}

  async addMember(
    workspaceId: number,
    userId: number,
    role: Role,
    client: Pool | PoolClient = this.pool,
  ): Promise<void> {
    await client.query(
      'INSERT INTO members (workspace_id, member, role) VALUES ($1, $2, $3)',
      [workspaceId, userId, role],
    );
  }

  async touchUpdatedAt(
    table: string,
    id: number,
    client: Pool | PoolClient = this.pool,
  ): Promise<void> {
    const now = new Date();
    await client.query(`UPDATE ${table} SET updated_at = $1 WHERE id = $2`, [
      now,
      id,
    ]);
  }

  async getMemberRole(
    workspaceId: number,
    userId: number,
    client: Pool | PoolClient = this.pool,
  ): Promise<Role | null> {
    const result = await client.query<{ role: Role }>(
      'SELECT role FROM members WHERE workspace_id = $1 AND member = $2',
      [workspaceId, userId],
    );

    return result.rows[0]?.role ?? null;
  }

  async createWorkspace(name: string, createdBy: number): Promise<void> {
    await this.transactionService.run(async (client) => {
      const result = await client.query<{ id: number }>(
        'INSERT INTO workspaces (name, created_by) VALUES ($1, $2) RETURNING id',
        [name, createdBy],
      );

      await this.addMember(result.rows[0].id, createdBy, 'owner', client);
    });
  }

  async updateWorkspace(workspaceId: number, name: string): Promise<void> {
    const result = await this.pool.query(
      'UPDATE workspaces SET name = $1 WHERE id = $2',
      [name, workspaceId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException('Workspace not found');
    }

    await this.touchUpdatedAt('workspaces', workspaceId);
  }

  async deleteWorkspace(workspaceId: number): Promise<void> {
    const result = await this.pool.query(
      'DELETE FROM workspaces WHERE id = $1',
      [workspaceId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException('Workspace not found');
    }
  }

  async selectRandomAdmin(
    workspaceId: number,
    client: Pool | PoolClient = this.pool,
  ): Promise<number> {
    const result = await client.query<{ member: number }>(
      'SELECT member FROM members WHERE workspace_id = $1 AND role = $2 LIMIT 1',
      [workspaceId, 'admin'],
    );

    if (result.rows.length === 0) {
      throw new ConflictException(
        'Unable to transfer ownership: no admin member found in this workspace',
      );
    }

    return result.rows[0].member;
  }

  async changeOwner(
    currentOwnerId: number,
    workspaceId: number,
    newOwnerId?: number,
  ): Promise<void> {
    await this.transactionService.run(async (client) => {
      const ownerId =
        newOwnerId ?? (await this.selectRandomAdmin(workspaceId, client));

      const newOwnerRole = await this.getMemberRole(
        workspaceId,
        ownerId,
        client,
      );
      if (newOwnerRole === null) {
        throw new NotFoundException(
          'New owner must be a member of this workspace',
        );
      }

      await client.query(
        'UPDATE members SET role = $1 WHERE member = $2 AND workspace_id = $3',
        ['owner', ownerId, workspaceId],
      );

      await client.query(
        'UPDATE members SET role = $1 WHERE member = $2 AND workspace_id = $3',
        ['admin', currentOwnerId, workspaceId],
      );
    });
  }

  async removeMember(
    userId: number,
    workspaceId: number,
    memberId: number,
  ): Promise<void> {
    if (!memberId)
      throw new BadRequestException('memberId is required to remove a member');

    const userRole = await this.getMemberRole(workspaceId, userId);
    const memberRole = await this.getMemberRole(workspaceId, memberId);

    if (memberRole === null) {
      throw new NotFoundException('Member not found in this workspace');
    }

    if (
      (userRole === 'admin' && memberRole === 'admin' && userId != memberId) ||
      (userRole === 'admin' && memberRole === 'owner')
    )
      throw new ForbiddenException(
        'Admins cannot remove other admins or the owner',
      );

    if (
      (userRole === 'member' &&
        (memberRole === 'owner' || memberRole === 'admin')) ||
      (userRole === 'member' && memberRole === 'member' && userId != memberId)
    )
      throw new ForbiddenException('Members can only remove themselves');

    if (userRole === 'owner' && userId === memberId) {
      await this.changeOwner(userId, workspaceId);
    }

    await this.pool.query(
      'DELETE FROM members WHERE member = $1 AND workspace_id = $2',
      [memberId, workspaceId],
    );
  }

  async updateRole(
    userId: number,
    workspaceId: number,
    memberId: number,
    role: Role,
  ): Promise<void> {
    if (role === 'owner') {
      await this.changeOwner(userId, workspaceId, memberId);
    } else if (userId === memberId && (role === 'admin' || role === 'member')) {
      await this.changeOwner(userId, workspaceId);
    } else {
      const result = await this.pool.query(
        'UPDATE members SET role = $1 WHERE member = $2 AND workspace_id = $3',
        [role, memberId, workspaceId],
      );

      if (result.rowCount === 0) {
        throw new NotFoundException('Member not found in this workspace');
      }
    }
  }

  async createProject(
    workspaceId: number,
    body: { name: string },
  ): Promise<void> {
    await this.pool.query(
      'INSERT INTO projects (name, workspace_id) VALUES ($1, $2)',
      [body.name, workspaceId],
    );
  }

  async updateProject(
    workspaceId: number,
    projectId: number,
    body: { name: string },
  ): Promise<void> {
    const project = await this.pool.query<{ id: number }>(
      'SELECT id FROM projects WHERE id = $1 AND workspace_id = $2',
      [projectId, workspaceId],
    );

    if (project.rows.length === 0) {
      throw new NotFoundException('Project not found in this workspace');
    }

    await this.pool.query('UPDATE projects SET name = $1 WHERE id = $2', [
      body.name,
      projectId,
    ]);

    await this.touchUpdatedAt('projects', projectId);
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
  }

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

    await this.pool.query(
      'INSERT INTO tasks (project_id, title, instructions, assigned_to, priority, status, completed_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
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

    const userRole = await this.getMemberRole(workspaceId, userId);

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
    await this.pool.query(
      `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${values.length}`,
      values,
    );

    await this.touchUpdatedAt('tasks', taskId);
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
  }

  async getWorkspaces(
    userId: number,
    page: number,
    search?: string,
    sortBy?: SortBy,
    sortOrder?: SortOrder,
  ): Promise<
    Array<{
      name: string;
      createdBy: number;
      createdAt: Date;
      updatedAt: Date;
    }>
  > {
    const offset = (page - 1) * 20;

    const sortColumns: Record<string, string> = {
      createdAt: 'w.created_at',
      updatedAt: 'w.updated_at',
    };

    const column = sortColumns[sortBy ?? 'createdAt'];
    const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const result = await this.pool.query<{
      name: string;
      createdBy: number;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `SELECT
       w.name AS "name",
       w.created_by AS "createdBy",
       w.created_at AS "createdAt",
       w.updated_at AS "updatedAt"
     FROM workspaces w
     JOIN members m ON m.workspace_id = w.id
     WHERE m.member = $1
       AND ($2 = '' OR w.name ILIKE '%' || $2 || '%')
     ORDER BY $3 $4
     LIMIT 20
     OFFSET $5`,
      [userId, search ?? '', column, direction, offset],
    );

    return result.rows;
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
       ORDER BY $3 $4
       LIMIT 20
       OFFSET $5`,
      [workspaceId, search ?? '', column, direction, offset],
    );

    return result.rows;
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
