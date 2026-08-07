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
  CreateProjectDto,
  CreateTask,
  Role,
  UpdateProjectDto,
  UpdateTaskDto,
} from './workspace.dto';
import { Pool } from 'pg';

@Injectable()
export class WorkspaceService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async addMember(
    workspaceId: number,
    userId: number,
    role: Role,
  ): Promise<void> {
    await this.pool.query(
      'INSERT INTO members (workspace_id, member, role) VALUES ($1, $2, $3)',
      [workspaceId, userId, role],
    );
  }

  async touchUpdatedAt(table: string, id: number): Promise<void> {
    const now = new Date();
    await this.pool.query(`UPDATE ${table} SET updated_at = $1 WHERE id = $2`, [
      now,
      id,
    ]);
  }

  async getMemberRole(workspaceId: number, userId: number): Promise<Role> {
    const result = await this.pool.query<{ role: Role }>(
      'SELECT role FROM members WHERE workspace_id = $1 AND member = $2',
      [workspaceId, userId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Member not found in this workspace');
    }

    return result.rows[0].role;
  }

  async createWorkspace(name: string, createdBy: number): Promise<void> {
    const result = await this.pool.query<{ id: number }>(
      'INSERT INTO workspaces (name, created_by) VALUES ($1, $2) RETURNING id',
      [name, createdBy],
    );

    await this.addMember(result.rows[0].id, createdBy, 'owner');
  }

  async updateWorkspace(workspaceId: number, name: string): Promise<void> {
    await this.pool.query('UPDATE workspaces SET name = $1 WHERE id = $2', [
      name,
      workspaceId,
    ]);

    await this.touchUpdatedAt('workspaces', workspaceId);
  }

  async deleteWorkspace(workspaceId: number): Promise<void> {
    await this.pool.query('DELETE FROM workspaces WHERE id = $1', [
      workspaceId,
    ]);
  }

  async selectRandomAdmin(workspaceId: number): Promise<number> {
    const result = await this.pool.query<{ member: number }>(
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
    const ownerId = newOwnerId ?? (await this.selectRandomAdmin(workspaceId));

    await this.pool.query(
      'UPDATE members SET role = $1 WHERE member = $2 AND workspace_id = $3',
      ['owner', ownerId, workspaceId],
    );

    await this.pool.query(
      'UPDATE members SET role = $1 WHERE member = $2 AND workspace_id = $3',
      ['admin', currentOwnerId, workspaceId],
    );
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
      throw new ForbiddenException(
        'Members can only remove themselves, not owners or admins',
      );

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
    } else {
      await this.pool.query(
        'UPDATE members SET role = $1 WHERE member = $2 AND workspace_id = $3',
        [role, memberId, workspaceId],
      );
    }
  }

  async createProject(
    workspaceId: number,
    body: CreateProjectDto,
  ): Promise<void> {
    await this.pool.query(
      'INSERT INTO projects (name, workspace_id) VALUES ($1, $2)',
      [body.name, workspaceId],
    );
  }

  async updateProject(
    workspaceId: number,
    projectId: number,
    body: UpdateProjectDto,
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
}
