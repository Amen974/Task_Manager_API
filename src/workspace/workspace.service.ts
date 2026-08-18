import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SortBy, SortOrder } from './workspace.dto';
import { Pool } from 'pg';
import { TransactionService } from '../database/Transaction.service';
import { PG_POOL } from '../database/pg-pool.token';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  WorkspaceCreatedEvent,
  WorkspaceDeletedEvent,
  WorkspaceUpdatedEvent,
} from '../realtime/events.event';
import { MemberService } from './member/member.service';

@Injectable()
export class WorkspaceService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly transactionService: TransactionService,
    private eventEmitter: EventEmitter2,
    private readonly memberService: MemberService,
  ) {}

  async createWorkspace(name: string, createdBy: number): Promise<void> {
    const createdAt = new Date();

    await this.transactionService.run(async (client) => {
      const updatedAt = new Date();

      const result = await client.query<{
        id: number;
        name: string;
        createdBy: number;
        createdAt: Date;
        updatedAt: Date;
      }>(
        `INSERT INTO workspaces 
        (name, created_by, updated_at) 
        VALUES ($1, $2, $3) 
        RETURNING id, name, created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt"`,
        [name, createdBy, updatedAt],
      );

      const workspace = result.rows[0];

      await this.memberService.addMember(
        workspace.id,
        createdBy,
        'owner',
        client,
      );

      this.eventEmitter.emit(
        'workspace.created',
        new WorkspaceCreatedEvent(workspace.id, workspace, createdAt),
      );
    });
  }

  async updateWorkspace(workspaceId: number, name: string): Promise<void> {
    const result = await this.pool.query<{ name: string; updatedAt: Date }>(
      'UPDATE workspaces SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING name, updated_at AS "updatedAt"',
      [name, workspaceId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException('Workspace not found');
    }

    const updatedAt = new Date();
    this.eventEmitter.emit(
      'workspace.updated',
      new WorkspaceUpdatedEvent(workspaceId, result.rows[0], updatedAt),
    );
  }

  async deleteWorkspace(workspaceId: number): Promise<void> {
    const result = await this.pool.query(
      'DELETE FROM workspaces WHERE id = $1',
      [workspaceId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException('Workspace not found');
    }

    this.eventEmitter.emit(
      'workspace.deleted',
      new WorkspaceDeletedEvent(workspaceId, workspaceId),
    );
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
}
