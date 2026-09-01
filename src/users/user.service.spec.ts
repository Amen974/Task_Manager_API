import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PG_POOL } from '../database/pg-pool.token';

describe('UserService', () => {
  let service: UserService;
  let mockPool: { query: jest.Mock };

  beforeEach(async () => {
    mockPool = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PG_POOL,
          useValue: mockPool,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserByEmail', () => {
    it('should return user record when found', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        name: 'Test User',
        created_at: new Date(),
      };
      mockPool.query.mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 });

      const result = await service.getUserByEmail('test@example.com');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'SELECT id, email, password_hash, name, created_at FROM users WHERE email = $1',
        ),
        ['test@example.com'],
      );
      expect(result).toEqual(mockUser);
    });

    it('should return undefined when user is not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await service.getUserByEmail('notfound@example.com');

      expect(result).toBeUndefined();
    });
  });

  describe('getUserById', () => {
    it('should return user record when found by ID', async () => {
      const mockUser = {
        id: 10,
        email: 'user10@example.com',
        password_hash: 'hash10',
        name: 'User Ten',
        created_at: new Date(),
      };
      mockPool.query.mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 });

      const result = await service.getUserById(10);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'SELECT id, email, password_hash, name, created_at FROM users WHERE id = $1',
        ),
        [10],
      );
      expect(result).toEqual(mockUser);
    });

    it('should return undefined when user ID is not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await service.getUserById(999);

      expect(result).toBeUndefined();
    });
  });

  describe('insertUser', () => {
    it('should insert a new user and return the row with id', async () => {
      const mockInserted = { id: 5 };
      mockPool.query.mockResolvedValueOnce({
        rows: [mockInserted],
        rowCount: 1,
      });

      const result = await service.insertUser(
        'new@example.com',
        'hashedpwd',
        'New User',
      );

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id',
        ),
        ['new@example.com', 'hashedpwd', 'New User'],
      );
      expect(result).toEqual(mockInserted);
    });
  });
});
