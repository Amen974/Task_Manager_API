import { Test, TestingModule } from '@nestjs/testing';
import { MemberService } from './member.service';
import { PG_POOL } from '../../database/pg-pool.token';
import { TransactionService } from '../../database/Transaction.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('MemberService', () => {
  let service: MemberService;
  let mockPool: { query: jest.Mock };
  let mockTransactionService: { run: jest.Mock };

  beforeEach(async () => {
    mockPool = {
      query: jest.fn(),
    };
    mockTransactionService = {
      run: jest.fn((work) => work(mockPool as any)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemberService,
        { provide: PG_POOL, useValue: mockPool },
        { provide: TransactionService, useValue: mockTransactionService },
      ],
    }).compile();

    service = module.get<MemberService>(MemberService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addMember', () => {
    it('should execute insert query with workspaceId, userId, and role', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.addMember(1, 10, 'member');

      expect(mockPool.query).toHaveBeenCalledWith(
        'INSERT INTO members (workspace_id, member, role) VALUES ($1, $2, $3)',
        [1, 10, 'member'],
      );
    });
  });

  describe('getMemberRole', () => {
    it('should return role when member exists', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ role: 'admin' }],
        rowCount: 1,
      });

      const role = await service.getMemberRole(1, 10);
      expect(role).toBe('admin');
    });

    it('should return null when member does not exist', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const role = await service.getMemberRole(1, 999);
      expect(role).toBeNull();
    });
  });

  describe('selectRandomAdmin', () => {
    it('should return admin member ID when admin exists', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ member: 42 }],
        rowCount: 1,
      });

      const adminId = await service.selectRandomAdmin(1);
      expect(adminId).toBe(42);
    });

    it('should throw ConflictException when no admin exists in workspace', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(service.selectRandomAdmin(1)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('changeOwner', () => {
    it('should transfer ownership to specified new owner when new owner is a member', async () => {
      // Mock getMemberRole for new owner
      mockPool.query.mockResolvedValueOnce({
        rows: [{ role: 'admin' }],
        rowCount: 1,
      });
      // Mock update new owner role to owner
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      // Mock update current owner role to admin
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.changeOwner(1, 100, 2);

      expect(mockTransactionService.run).toHaveBeenCalled();
      expect(mockPool.query).toHaveBeenCalledWith(
        'UPDATE members SET role = $1 WHERE member = $2 AND workspace_id = $3',
        ['owner', 2, 100],
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        'UPDATE members SET role = $1 WHERE member = $2 AND workspace_id = $3',
        ['admin', 1, 100],
      );
    });

    it('should throw NotFoundException if specified new owner is not a member', async () => {
      // Mock getMemberRole returning null
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(service.changeOwner(1, 100, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should pick random admin if newOwnerId is not provided', async () => {
      // Mock selectRandomAdmin query
      mockPool.query.mockResolvedValueOnce({
        rows: [{ member: 5 }],
        rowCount: 1,
      });
      // Mock getMemberRole for admin
      mockPool.query.mockResolvedValueOnce({
        rows: [{ role: 'admin' }],
        rowCount: 1,
      });
      // Mock update roles
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.changeOwner(1, 100);

      expect(mockPool.query).toHaveBeenCalledWith(
        'UPDATE members SET role = $1 WHERE member = $2 AND workspace_id = $3',
        ['owner', 5, 100],
      );
    });
  });

  describe('removeMember', () => {
    it('should throw BadRequestException if memberId is falsy', async () => {
      await expect(service.removeMember(1, 100, 0)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if target member does not exist in workspace', async () => {
      // userRole query
      mockPool.query.mockResolvedValueOnce({ rows: [{ role: 'owner' }], rowCount: 1 });
      // memberRole query
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(service.removeMember(1, 100, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if an admin tries to remove another admin', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ role: 'admin' }], rowCount: 1 });
      mockPool.query.mockResolvedValueOnce({ rows: [{ role: 'admin' }], rowCount: 1 });

      await expect(service.removeMember(2, 100, 3)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if an admin tries to remove the owner', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ role: 'admin' }], rowCount: 1 });
      mockPool.query.mockResolvedValueOnce({ rows: [{ role: 'owner' }], rowCount: 1 });

      await expect(service.removeMember(2, 100, 1)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if a regular member tries to remove another member', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ role: 'member' }], rowCount: 1 });
      mockPool.query.mockResolvedValueOnce({ rows: [{ role: 'member' }], rowCount: 1 });

      await expect(service.removeMember(4, 100, 5)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow a regular member to remove themselves', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ role: 'member' }], rowCount: 1 });
      mockPool.query.mockResolvedValueOnce({ rows: [{ role: 'member' }], rowCount: 1 });
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // DELETE query

      await service.removeMember(4, 100, 4);

      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM members WHERE member = $1 AND workspace_id = $2',
        [4, 100],
      );
    });

    it('should trigger changeOwner when owner removes themselves', async () => {
      // userRole query
      mockPool.query.mockResolvedValueOnce({ rows: [{ role: 'owner' }], rowCount: 1 });
      // memberRole query
      mockPool.query.mockResolvedValueOnce({ rows: [{ role: 'owner' }], rowCount: 1 });

      // inside changeOwner: selectRandomAdmin
      mockPool.query.mockResolvedValueOnce({ rows: [{ member: 2 }], rowCount: 1 });
      // getMemberRole for new owner
      mockPool.query.mockResolvedValueOnce({ rows: [{ role: 'admin' }], rowCount: 1 });
      // update roles
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      // DELETE query
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.removeMember(1, 100, 1);

      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM members WHERE member = $1 AND workspace_id = $2',
        [1, 100],
      );
    });
  });

  describe('updateRole', () => {
    it('should trigger changeOwner when role is set to owner', async () => {
      // changeOwner -> getMemberRole for target
      mockPool.query.mockResolvedValueOnce({ rows: [{ role: 'admin' }], rowCount: 1 });
      // update new owner
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      // update current owner
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.updateRole(1, 100, 2, 'owner');

      expect(mockPool.query).toHaveBeenCalledWith(
        'UPDATE members SET role = $1 WHERE member = $2 AND workspace_id = $3',
        ['owner', 2, 100],
      );
    });

    it('should update role in DB when changing role for another member to admin or member', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.updateRole(1, 100, 2, 'admin');

      expect(mockPool.query).toHaveBeenCalledWith(
        'UPDATE members SET role = $1 WHERE member = $2 AND workspace_id = $3',
        ['admin', 2, 100],
      );
    });

    it('should throw NotFoundException if member to update is not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(service.updateRole(1, 100, 999, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
