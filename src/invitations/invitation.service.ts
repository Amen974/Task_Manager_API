import { Pool } from 'pg';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { StringValue } from 'ms';
import { TransactionService } from '../database/Transaction.service';
import { PG_POOL } from '../database/pg-pool.token';
import { MemberService } from '../workspace/member/member.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Status } from '../types/workspace.types';

@Injectable()
export class InvitationService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @InjectQueue('email')
    private readonly emailQueue: Queue,
    private readonly memberService: MemberService,
    private readonly configService: ConfigService,
    private jwtService: JwtService,
    private readonly transactionService: TransactionService,
  ) {}

  async getInviteContext(
    workspaceId: number,
    createdBy: number,
  ): Promise<{ workspaceName: string; inviterName: string }> {
    const result = await this.pool.query<{
      workspace_name: string;
      inviter_name: string;
    }>(
      `SELECT w.name AS workspace_name, u.name AS inviter_name
       FROM workspaces w, users u
       WHERE w.id = $1 AND u.id = $2`,
      [workspaceId, createdBy],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException('Workspace or inviting user not found.');
    }

    return {
      workspaceName: result.rows[0].workspace_name,
      inviterName: result.rows[0].inviter_name,
    };
  }

  generateToken(email: string, workspaceId: number) {
    const invitationToken = this.jwtService.sign(
      { email, workspaceId },
      {
        secret: this.configService.get<string>('INVITATION_TOKEN_SECRET'),
        expiresIn: this.configService.get<string>(
          'INVITATION_TOKEN_EXPIRES_IN',
        ) as StringValue,
      },
    );
    return invitationToken;
  }

  expiresIn(): Date {
    const expires = this.configService.get<string>(
      'INVITATION_TOKEN_EXPIRES_IN',
    )!;

    const days = Number(expires.slice(0, -1));

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    return expiresAt;
  }

  async existInvitation(email: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT email FROM invitations WHERE email = $1',
      [email],
    );

    if (result.rowCount !== 0) return true;

    return false;
  }

  async storeInvitation(
    workspaceId: number,
    email: string,
    hashToken: string,
    createdBy: number,
    expiresAt: Date,
  ): Promise<void> {
    await this.pool.query(
      'INSERT INTO invitations (workspace_id, email, token_hash, status, created_by, expires_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [workspaceId, email, hashToken, 'pending', createdBy, expiresAt],
    );
  }

  async generateInvitation(
    workspaceId: number,
    email: string,
    createdBy: number,
  ): Promise<void> {
    const expiresAt = this.expiresIn();
    const invitationToken = this.generateToken(email, workspaceId);
    const hashToken = await bcrypt.hash(invitationToken, 10);

    const exist = await this.existInvitation(email);
    if (exist)
      throw new ConflictException(
        'A pending invitation already exists for this email in this workspace.',
      );

    await this.storeInvitation(
      workspaceId,
      email,
      hashToken,
      createdBy,
      expiresAt,
    );

    const { workspaceName, inviterName } = await this.getInviteContext(
      workspaceId,
      createdBy,
    );

    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const acceptUrl = `${frontendUrl}/invitations/accept?token=${invitationToken}`;
    const declineUrl = `${frontendUrl}/invitations/decline?token=${invitationToken}`;

    await this.emailQueue.add(
      'send-invitation',
      {
        email,
        inviterName,
        workspaceName,
        acceptUrl,
        declineUrl,
      },
      { delay: 3000, attempts: 5, removeOnComplete: true, removeOnFail: true },
    );
  }

  async getHashToken(
    email: string,
    workspaceId: number,
  ): Promise<{
    id: number;
    workspace_id: number;
    token_hash: string;
    status: Status;
    expires_at: Date;
  }> {
    const hashToken = await this.pool.query<{
      id: number;
      workspace_id: number;
      token_hash: string;
      status: Status;
      expires_at: Date;
    }>(
      `SELECT id, workspace_id, token_hash, status, expires_at
       FROM invitations
       WHERE email = $1 AND status = 'pending' AND workspace_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [email, workspaceId],
    );

    if (hashToken.rowCount === 0) {
      throw new NotFoundException(
        'Invitation not found for the provided email address.',
      );
    }

    return hashToken.rows[0];
  }

  async verifyToken(
    invitationToken: string,
  ): Promise<{ invitationId: number; workspaceId: number; email: string }> {
    let payload: { email: string; workspaceId: number };
    try {
      payload = this.jwtService.verify(invitationToken, {
        secret: this.configService.get<string>('INVITATION_TOKEN_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(
        'Invalid invitation token. Please use the latest invitation link.',
      );
    }

    if (!payload?.email) {
      throw new NotFoundException(
        'Invitation token payload is missing an email address.',
      );
    }

    if (!payload?.workspaceId) {
      throw new NotFoundException(
        'Invitation token payload is missing the workspace.',
      );
    }

    const tokenRow = await this.getHashToken(
      payload.email,
      payload.workspaceId,
    );

    const matches = await bcrypt.compare(invitationToken, tokenRow.token_hash);
    if (!matches) {
      throw new UnauthorizedException(
        'Invitation token does not match our records. Please request a new invitation.',
      );
    }

    if (tokenRow.expires_at.getTime() < Date.now()) {
      throw new UnauthorizedException(
        'Invitation link has expired. Please request a new invitation.',
      );
    }

    return {
      invitationId: tokenRow.id,
      workspaceId: tokenRow.workspace_id,
      email: payload.email,
    };
  }

  async acceptInvitation(
    invitationToken: string,
    userId: number,
  ): Promise<void> {
    const { invitationId, workspaceId } =
      await this.verifyToken(invitationToken);

    await this.transactionService.run(async (client) => {
      await this.memberService.addMember(workspaceId, userId, 'member');

      await client.query(
        "UPDATE invitations SET status = 'accepted', updated_at = $1 WHERE id = $2",
        [new Date(), invitationId],
      );
    });
  }

  async declineInvitation(invitationToken: string): Promise<void> {
    const { invitationId } = await this.verifyToken(invitationToken);

    await this.pool.query(
      "UPDATE invitations SET status = 'declined', updated_at = $1 WHERE id = $2",
      [new Date(), invitationId],
    );
  }
}
