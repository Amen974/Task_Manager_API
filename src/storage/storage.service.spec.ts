import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { ConfigService } from '@nestjs/config';
import { PG_POOL } from '../database/pg-pool.token';
import { BadRequestException, NotFoundException } from '@nestjs/common';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest
    .fn()
    .mockResolvedValue('https://s3.example.com/presigned-url'),
}));

describe('StorageService', () => {
  let service: StorageService;
  let mockPool: { query: jest.Mock };
  let mockConfigService: { getOrThrow: jest.Mock };
  let mockB2Client: { send: jest.Mock };

  beforeEach(async () => {
    mockPool = { query: jest.fn() };
    mockConfigService = {
      getOrThrow: jest.fn().mockReturnValue('test-bucket'),
    };
    mockB2Client = { send: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: PG_POOL, useValue: mockPool },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: 'B2_CLIENT', useValue: mockB2Client },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUploadUrl', () => {
    it('should throw NotFoundException if task is not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(
        service.createUploadUrl('image/png', 1, 10, 20),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return signedUrl and fileId when task exists', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 20 }], rowCount: 1 });

      const result = await service.createUploadUrl('image/png', 1, 10, 20);

      expect(result).toEqual({
        signedUrl: 'https://s3.example.com/presigned-url',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        fileId: expect.any(String),
      });
    });
  });

  describe('confirmUpload', () => {
    it('should throw NotFoundException if task does not exist', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(
        service.confirmUpload(1, 10, 20, 'file-123', 'test.png', 5),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if S3 HeadObjectCommand throws error', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 20 }], rowCount: 1 });
      mockB2Client.send.mockRejectedValueOnce(new Error('S3 NotFound'));

      await expect(
        service.confirmUpload(1, 10, 20, 'file-123', 'test.png', 5),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if S3 object metadata is incomplete', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 20 }], rowCount: 1 });
      mockB2Client.send.mockResolvedValueOnce({ ContentLength: undefined }); // missing ContentType/ContentLength

      await expect(
        service.confirmUpload(1, 10, 20, 'file-123', 'test.png', 5),
      ).rejects.toThrow(BadRequestException);
    });

    it('should insert file record and return id and fileId on success', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 20 }], rowCount: 1 });
      mockB2Client.send.mockResolvedValueOnce({
        ContentLength: 1024,
        ContentType: 'image/png',
      });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 100 }],
        rowCount: 1,
      }); // INSERT RETURNING id

      const result = await service.confirmUpload(
        1,
        10,
        20,
        'file-123',
        'test.png',
        5,
      );

      expect(result).toEqual({ id: 100, fileId: 'file-123' });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO files'),
        [
          20,
          'workspaces/1/projects/10/tasks/20/files/file-123',
          'test.png',
          'image/png',
          1024,
          5,
        ],
      );
    });
  });

  describe('getFile', () => {
    it('should throw NotFoundException if file is not found in database', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(service.getFile(1, 10, 20, 'file-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return signedUrl when file is found', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { storage_key: 'workspaces/1/projects/10/tasks/20/files/file-123' },
        ],
        rowCount: 1,
      });

      const result = await service.getFile(1, 10, 20, 'file-123');

      expect(result).toEqual({
        signedUrl: 'https://s3.example.com/presigned-url',
      });
    });
  });
});
