import { Test, TestingModule } from '@nestjs/testing';
import { TaskService } from './task.service';
import { PG_POOL } from '../../database/pg-pool.token';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MemberService } from '../member/member.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('TaskService', () => {
  let service: TaskService;
  let mockPool: { query: jest.Mock };
  let mockEventEmitter: { emit: jest.Mock };
  let mockMemberService: { getMemberRole: jest.Mock };

  beforeEach(async () => {
    mockPool = { query: jest.fn() };
    mockEventEmitter = { emit: jest.fn() };
    mockMemberService = { getMemberRole: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: PG_POOL, useValue: mockPool },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: MemberService, useValue: mockMemberService },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTask', () => {
    const createTaskDto = {
      title: 'New Task',
      instructions: 'Do this',
      assignedTo: 2,
      priority: 'high' as const,
      status: 'pending' as const,
      completedAt: null,
    };

    it('should throw NotFoundException if project does not exist in workspace', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(service.createTask(1, 10, createTaskDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should insert task, emit task.created event, and return created task', async () => {
      // project check
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 10 }], rowCount: 1 });
      // task insert
      const createdTask = {
        title: 'New Task',
        instructions: 'Do this',
        assignedTo: 2,
        priority: 'high',
        status: 'pending',
        completedAt: null,
      };
      mockPool.query.mockResolvedValueOnce({
        rows: [createdTask],
        rowCount: 1,
      });

      const result = await service.createTask(1, 10, createTaskDto);

      expect(result).toEqual(createdTask);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'task.created',
        expect.any(Object),
      );
    });
  });

  describe('updateTask', () => {
    const updateDto = { title: 'Updated Title' };

    it('should throw NotFoundException if task does not exist', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(
        service.updateTask(1, 10, 20, 30, updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is member and task is assigned to someone else', async () => {
      // task lookup returns assignedTo: 99
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 30, assignedTo: 99 }],
        rowCount: 1,
      });
      // userRole returns 'member'
      mockMemberService.getMemberRole.mockResolvedValueOnce('member');

      await expect(
        service.updateTask(1, 10, 20, 30, updateDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow user to update task if user is member AND task is assigned to self', async () => {
      // task lookup returns assignedTo: 1 (matching userId 1)
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 30, assignedTo: 1 }],
        rowCount: 1,
      });
      mockMemberService.getMemberRole.mockResolvedValueOnce('member');
      const updatedTask = {
        title: 'Updated Title',
        instructions: null,
        assignedTo: 1,
        priority: 'low',
        status: 'pending',
        completedAt: null,
      };
      mockPool.query.mockResolvedValueOnce({
        rows: [updatedTask],
        rowCount: 1,
      });

      const result = await service.updateTask(1, 10, 20, 30, updateDto);

      expect(result).toEqual(updatedTask);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'task.updated',
        expect.any(Object),
      );
    });

    it('should allow admin or owner to update any task', async () => {
      // task lookup returns assignedTo: 99
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 30, assignedTo: 99 }],
        rowCount: 1,
      });
      mockMemberService.getMemberRole.mockResolvedValueOnce('admin');
      const updatedTask = {
        title: 'Updated Title',
        instructions: null,
        assignedTo: 99,
        priority: 'high',
        status: 'completed',
        completedAt: new Date(),
      };
      mockPool.query.mockResolvedValueOnce({
        rows: [updatedTask],
        rowCount: 1,
      });

      const result = await service.updateTask(1, 10, 20, 30, updateDto);

      expect(result).toEqual(updatedTask);
    });

    it('should throw BadRequestException if no fields are provided to update', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 30, assignedTo: 1 }],
        rowCount: 1,
      });
      mockMemberService.getMemberRole.mockResolvedValueOnce('owner');

      await expect(service.updateTask(1, 10, 20, 30, {})).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('deleteTask', () => {
    it('should throw NotFoundException if task does not exist', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(service.deleteTask(10, 30)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should delete task and emit task.delete event', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 30 }], rowCount: 1 });
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.deleteTask(10, 30);

      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM tasks WHERE id = $1',
        [30],
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'task.delete',
        expect.any(Object),
      );
    });
  });

  describe('getTask', () => {
    it('should query tasks with status, assignedTo, priority filters and pagination', async () => {
      const mockTasks = [
        {
          title: 'Task A',
          instructions: null,
          assignedTo: 1,
          priority: 'high',
          status: 'pending',
          createdAt: new Date(),
          completedAt: null,
          updatedAt: new Date(),
        },
      ];
      mockPool.query.mockResolvedValueOnce({ rows: mockTasks, rowCount: 1 });

      const result = await service.getTask(
        20, // projectId
        10, // workspaceId
        1, // page
        'pending',
        1,
        'high',
        'createdAt',
        'desc',
        'Task',
      );

      expect(result).toEqual(mockTasks);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE p.id = $1 AND p.workspace_id = $2'),
        expect.arrayContaining([20, 10, 'pending', 1, 'high', 'Task', 0]),
      );
    });
  });
});
