import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceService } from './workspace.service';
import { PG_POOL } from '../database/pg-pool.token';
import { TransactionService } from '../database/Transaction.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MemberService } from './member/member.service';
import { NotFoundException } from '@nestjs/common';

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  let mockPool: { query: jest.Mock };
  let mockTransactionService: { run: jest.Mock };
  let mockEventEmitter: { emit: jest.Mock };
  let mockMemberService: { addMember: jest.Mock };

  beforeEach(async () => {
    mockPool = { query: jest.fn() };
    mockTransactionService = {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
      run: jest.fn((work) => work(mockPool as any)),
    };
    mockEventEmitter = { emit: jest.fn() };
    mockMemberService = { addMember: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceService,
        { provide: PG_POOL, useValue: mockPool },
        { provide: TransactionService, useValue: mockTransactionService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: MemberService, useValue: mockMemberService },
      ],
    }).compile();

    service = module.get<WorkspaceService>(WorkspaceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createWorkspace', () => {
    it('should create workspace, add creator as owner, and emit workspace.created event', async () => {
      const mockWorkspace = {
        id: 1,
        name: 'My Workspace',
        createdBy: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPool.query.mockResolvedValueOnce({
        rows: [mockWorkspace],
        rowCount: 1,
      });

      await service.createWorkspace('My Workspace', 10);

      expect(mockTransactionService.run).toHaveBeenCalled();
      expect(mockMemberService.addMember).toHaveBeenCalledWith(
        1,
        10,
        'owner',
        mockPool,
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'workspace.created',
        expect.any(Object),
      );
    });
  });

  describe('updateWorkspace', () => {
    it('should update workspace name and emit workspace.updated event', async () => {
      const mockUpdated = { name: 'Updated Workspace', updatedAt: new Date() };
      mockPool.query.mockResolvedValueOnce({
        rows: [mockUpdated],
        rowCount: 1,
      });

      await service.updateWorkspace(1, 'Updated Workspace');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'workspace.updated',
        expect.any(Object),
      );
    });

    it('should throw NotFoundException if workspace does not exist', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(service.updateWorkspace(999, 'Name')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteWorkspace', () => {
    it('should delete workspace and emit workspace.deleted event', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.deleteWorkspace(1);

      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM workspaces WHERE id = $1',
        [1],
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'workspace.deleted',
        expect.any(Object),
      );
    });

    it('should throw NotFoundException if workspace to delete is missing', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(service.deleteWorkspace(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getWorkspaces', () => {
    it('should query workspaces for user with search and pagination', async () => {
      const mockWorkspaces = [
        {
          name: 'Workspace 1',
          createdBy: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockPool.query.mockResolvedValueOnce({
        rows: mockWorkspaces,
        rowCount: 1,
      });

      const result = await service.getWorkspaces(
        10,
        1,
        'Workspace',
        'createdAt',
        'desc',
      );

      expect(result).toEqual(mockWorkspaces);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('JOIN members m ON m.workspace_id = w.id'),
        [10, 'Workspace', 0],
      );
    });
  });
});
