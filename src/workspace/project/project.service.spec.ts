import { Test, TestingModule } from '@nestjs/testing';
import { ProjectService } from './project.service';
import { PG_POOL } from '../../database/pg-pool.token';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException } from '@nestjs/common';

describe('ProjectService', () => {
  let service: ProjectService;
  let mockPool: { query: jest.Mock };
  let mockEventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    mockPool = { query: jest.fn() };
    mockEventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: PG_POOL, useValue: mockPool },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createProject', () => {
    it('should insert project and emit project.created event', async () => {
      const mockProject = {
        name: 'Project Alpha',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPool.query.mockResolvedValueOnce({
        rows: [mockProject],
        rowCount: 1,
      });

      await service.createProject(1, { name: 'Project Alpha' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO projects (name, workspace_id)'),
        ['Project Alpha', 1],
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'project.created',
        expect.any(Object),
      );
    });
  });

  describe('updateProject', () => {
    it('should update project name and emit project.updated event', async () => {
      // project check
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 10 }], rowCount: 1 });
      // update project
      const mockUpdated = { name: 'Updated Alpha', updatedAt: new Date() };
      mockPool.query.mockResolvedValueOnce({
        rows: [mockUpdated],
        rowCount: 1,
      });

      const result = await service.updateProject(1, 10, {
        name: 'Updated Alpha',
      });

      expect(result).toEqual(mockUpdated);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'project.updated',
        expect.any(Object),
      );
    });

    it('should throw NotFoundException if project is not in workspace', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(
        service.updateProject(1, 999, { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteProject', () => {
    it('should delete project and emit project.deleted event', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 10 }], rowCount: 1 });
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.deleteProject(1, 10);

      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM projects WHERE id = $1',
        [10],
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'project.deleted',
        expect.any(Object),
      );
    });

    it('should throw NotFoundException if project to delete does not exist', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(service.deleteProject(1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getProject', () => {
    it('should query projects for workspace with search and pagination', async () => {
      const mockProjects = [
        { name: 'Proj 1', createdAt: new Date(), updatedAt: new Date() },
      ];
      mockPool.query.mockResolvedValueOnce({
        rows: mockProjects,
        rowCount: 1,
      });

      const result = await service.getProject(1, 1, 'Proj', 'createdAt', 'asc');

      expect(result).toEqual(mockProjects);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE w.id = $1'),
        [1, 'Proj', 0],
      );
    });
  });
});
