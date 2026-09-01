import { Test, TestingModule } from '@nestjs/testing';
import { InvitationService } from './invitation.service';
import { PG_POOL } from '../database/pg-pool.token';
import { MemberService } from '../workspace/member/member.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TransactionService } from '../database/Transaction.service';
import { getQueueToken } from '@nestjs/bullmq';
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('InvitationService', () => {
  let service: InvitationService;
  let mockPool: { query: jest.Mock };
  let mockEmailQueue: { add: jest.Mock };
  let mockMemberService: { addMember: jest.Mock };
  let mockConfigService: { get: jest.Mock };
  let mockJwtService: { sign: jest.Mock; verify: jest.Mock };
  let mockTransactionService: { run: jest.Mock };

  beforeEach(async () => {
    mockPool = { query: jest.fn() };
    mockEmailQueue = { add: jest.fn() };
    mockMemberService = { addMember: jest.fn() };
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'INVITATION_TOKEN_SECRET') return 'invite-secret';
        if (key === 'INVITATION_TOKEN_EXPIRES_IN') return '7d';
        if (key === 'FRONTEND_URL') return 'http://localhost:3000';
        return undefined;
      }),
    };
    mockJwtService = {
      sign: jest.fn().mockReturnValue('jwt.invite.token'),
      verify: jest.fn(),
    };
    mockTransactionService = {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
      run: jest.fn((work) => work(mockPool as any)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationService,
        { provide: PG_POOL, useValue: mockPool },
        { provide: getQueueToken('email'), useValue: mockEmailQueue },
        { provide: MemberService, useValue: mockMemberService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: TransactionService, useValue: mockTransactionService },
      ],
    }).compile();

    service = module.get<InvitationService>(InvitationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getInviteContext', () => {
    it('should return workspaceName and inviterName when found', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ workspace_name: 'Dev Workspace', inviter_name: 'Alice' }],
        rowCount: 1,
      });

      const context = await service.getInviteContext(1, 10);
      expect(context).toEqual({
        workspaceName: 'Dev Workspace',
        inviterName: 'Alice',
      });
    });

    it('should throw NotFoundException when rowCount is 0', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(service.getInviteContext(1, 10)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('generateInvitation', () => {
    it('should throw ConflictException if invitation already exists', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ email: 'invitee@example.com' }],
        rowCount: 1,
      });

      await expect(
        service.generateInvitation(1, 'invitee@example.com', 10),
      ).rejects.toThrow(ConflictException);
    });

    it('should store invitation and queue email job when no prior invitation exists', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ workspace_name: 'Dev Workspace', inviter_name: 'Alice' }],
        rowCount: 1,
      });

      mockJwtService.sign.mockReturnValue('jwt.invite.token');

      await service.generateInvitation(1, 'invitee@example.com', 10);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO invitations'),
        expect.arrayContaining([1, 'invitee@example.com']),
      );
      expect(mockEmailQueue.add).toHaveBeenCalledWith(
        'send-invitation',
        expect.objectContaining({
          email: 'invitee@example.com',
          inviterName: 'Alice',
          workspaceName: 'Dev Workspace',
          acceptUrl:
            'http://localhost:3000/invitations/accept?token=jwt.invite.token',
          declineUrl:
            'http://localhost:3000/invitations/decline?token=jwt.invite.token',
        }),
        expect.any(Object),
      );
    });
  });

  describe('verifyToken', () => {
    const rawToken = 'valid.invite.token';
    const hashedToken = bcrypt.hashSync(rawToken, 10);

    it('should throw UnauthorizedException if jwt verify fails', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(service.verifyToken(rawToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw NotFoundException if token payload is missing email', async () => {
      mockJwtService.verify.mockReturnValue({ workspaceId: 1 });

      await expect(service.verifyToken(rawToken)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if token payload is missing workspaceId', async () => {
      mockJwtService.verify.mockReturnValue({ email: 'test@example.com' });

      await expect(service.verifyToken(rawToken)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw UnauthorizedException if bcrypt comparison fails', async () => {
      mockJwtService.verify.mockReturnValue({
        email: 'test@example.com',
        workspaceId: 1,
      });

      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            workspace_id: 1,
            token_hash: bcrypt.hashSync('other.token', 10),
            status: 'pending',
            expires_at: new Date(Date.now() + 100000),
          },
        ],
        rowCount: 1,
      });

      await expect(service.verifyToken(rawToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if invitation is expired', async () => {
      mockJwtService.verify.mockReturnValue({
        email: 'test@example.com',
        workspaceId: 1,
      });
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            workspace_id: 1,
            token_hash: hashedToken,
            status: 'pending',
            expires_at: new Date(Date.now() - 100000),
          },
        ],
        rowCount: 1,
      });

      await expect(service.verifyToken(rawToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return invitation details when token is valid', async () => {
      mockJwtService.verify.mockReturnValue({
        email: 'test@example.com',
        workspaceId: 1,
      });
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            workspace_id: 1,
            token_hash: hashedToken,
            status: 'pending',
            expires_at: new Date(Date.now() + 100000),
          },
        ],
        rowCount: 1,
      });

      const result = await service.verifyToken(rawToken);
      expect(result).toEqual({
        invitationId: 10,
        workspaceId: 1,
        email: 'test@example.com',
      });
    });
  });

  describe('acceptInvitation', () => {
    it('should verify token, add member, and update invitation status to accepted in transaction', async () => {
      const rawToken = 'valid.invite.token';
      const hashedToken = bcrypt.hashSync(rawToken, 10);

      mockJwtService.verify.mockReturnValue({
        email: 'test@example.com',
        workspaceId: 1,
      });

      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            workspace_id: 1,
            token_hash: hashedToken,
            status: 'pending',
            expires_at: new Date(Date.now() + 100000),
          },
        ],
        rowCount: 1,
      });

      mockMemberService.addMember.mockResolvedValueOnce(undefined);

      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.acceptInvitation(rawToken, 5);

      expect(mockMemberService.addMember).toHaveBeenCalledWith(1, 5, 'member');
      expect(mockTransactionService.run).toHaveBeenCalled();
    });
  });

  describe('declineInvitation', () => {
    it('should verify token and update invitation status to declined', async () => {
      const rawToken = 'valid.invite.token';
      const hashedToken = bcrypt.hashSync(rawToken, 10);

      mockJwtService.verify.mockReturnValue({
        email: 'test@example.com',
        workspaceId: 1,
      });
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            workspace_id: 1,
            token_hash: hashedToken,
            status: 'pending',
            expires_at: new Date(Date.now() + 100000),
          },
        ],
        rowCount: 1,
      });
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.declineInvitation(rawToken);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE invitations SET status = 'declined'"),
        [expect.any(Date), 10],
      );
    });
  });
});
