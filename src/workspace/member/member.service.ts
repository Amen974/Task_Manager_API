import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { PG_POOL } from '../../database/pg-pool.token';
import { TransactionService } from '../../database/Transaction.service';
import { Role } from '../../types/workspace.types';

@Injectable()
export class MemberService {
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
}
