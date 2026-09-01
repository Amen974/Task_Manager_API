import { Test, TestingModule } from '@nestjs/testing';
import { RefreshTokenService } from './refresh-token.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PG_POOL } from '../database/pg-pool.token';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let mockPool: { query: jest.Mock };
  let mockJwtService: { sign: jest.Mock; verify: jest.Mock };
  let mockConfigService: { get: jest.Mock };

  beforeEach(async () => {
    mockPool = {
      query: jest.fn(),
    };
    mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'REFRESH_TOKEN_EXPIRES_IN') return '1d';
        if (key === 'REFRESH_TOKEN_SECRET') return 'test-secret';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        { provide: PG_POOL, useValue: mockPool },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<RefreshTokenService>(RefreshTokenService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('expiresIn', () => {
    it('should return a Date in the future based on config', () => {
      const futureDate = service.expiresIn();
      expect(futureDate.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('reserveTokenRow', () => {
    it('should insert a token row and return its id', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 42 }], rowCount: 1 });

      const id = await service.reserveTokenRow(1, 'fam-123');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO refresh_tokens'),
        [1, 'fam-123', expect.any(Date)],
      );
      expect(id).toBe(42);
    });
  });

  describe('createRefreshToken', () => {
    it('should generate a token, save its hash, and return the signed JWT token', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 100 }],
        rowCount: 1,
      });
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      mockJwtService.sign.mockReturnValue('signed.jwt.token');

      const token = await service.createRefreshToken(1, 'fam-456');

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { id: 100, userId: 1, family_id: 'fam-456' },
        { secret: 'test-secret', expiresIn: '1d' },
      );
      expect(token).toBe('signed.jwt.token');
    });
  });

  describe('getTokenRow', () => {
    it('should return token row when found', async () => {
      const mockRow = {
        user_id: 1,
        family_id: 'fam-1',
        token_hash: 'hash',
        used: false,
        expires_at: new Date(),
      };
      mockPool.query.mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 });

      const result = await service.getTokenRow(10);
      expect(result).toEqual(mockRow);
    });

    it('should throw UnauthorizedException when token row is not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(service.getTokenRow(999)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('revokeTokenFamily', () => {
    it('should execute update query to set revoked_at', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.revokeTokenFamily('fam-789');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'UPDATE refresh_tokens SET revoked_at = NOW() WHERE family_id = $1',
        ),
        ['fam-789'],
      );
    });
  });

  describe('isRevokedToken', () => {
    it('should return true if revoked_at is not null', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ revoked_at: new Date() }],
        rowCount: 1,
      });

      const result = await service.isRevokedToken('fam-1');
      expect(result).toBe(true);
    });

    it('should return false if revoked_at is null', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ revoked_at: null }],
        rowCount: 1,
      });

      const result = await service.isRevokedToken('fam-1');
      expect(result).toBe(false);
    });

    it('should return false if row count is 0', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await service.isRevokedToken('fam-1');
      expect(result).toBe(false);
    });
  });

  describe('validateRefreshToken', () => {
    const rawToken = 'valid.jwt.token';
    const hashedToken = bcrypt.hashSync(rawToken, 10);
    const validPayload = { id: 10, userId: 1, family_id: 'fam-valid' };

    it('should throw UnauthorizedException if jwt verify fails', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid jwt');
      });

      await expect(
        service.validateRefreshToken('invalid.token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if payload userId or family_id does not match token row', async () => {
      mockJwtService.verify.mockReturnValue(validPayload);
      const mismatchedRow = {
        user_id: 99,
        family_id: 'fam-valid',
        token_hash: hashedToken,
        used: false,
        expires_at: new Date(Date.now() + 100000),
      };
      mockPool.query.mockResolvedValueOnce({
        rows: [mismatchedRow],
        rowCount: 1,
      });

      await expect(service.validateRefreshToken(rawToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if bcrypt comparison fails', async () => {
      mockJwtService.verify.mockReturnValue(validPayload);
      const wrongHashRow = {
        user_id: 1,
        family_id: 'fam-valid',
        token_hash: bcrypt.hashSync('different-token', 10),
        used: false,
        expires_at: new Date(Date.now() + 100000),
      };
      mockPool.query.mockResolvedValueOnce({
        rows: [wrongHashRow],
        rowCount: 1,
      });

      await expect(service.validateRefreshToken(rawToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if token family is revoked', async () => {
      mockJwtService.verify.mockReturnValue(validPayload);
      const tokenRow = {
        user_id: 1,
        family_id: 'fam-valid',
        token_hash: hashedToken,
        used: false,
        expires_at: new Date(Date.now() + 100000),
      };
      mockPool.query.mockResolvedValueOnce({ rows: [tokenRow], rowCount: 1 });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ revoked_at: new Date() }],
        rowCount: 1,
      });

      await expect(service.validateRefreshToken(rawToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if token is expired', async () => {
      mockJwtService.verify.mockReturnValue(validPayload);
      const expiredRow = {
        user_id: 1,
        family_id: 'fam-valid',
        token_hash: hashedToken,
        used: false,
        expires_at: new Date(Date.now() - 100000),
      };
      mockPool.query.mockResolvedValueOnce({ rows: [expiredRow], rowCount: 1 });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ revoked_at: null }],
        rowCount: 1,
      });

      await expect(service.validateRefreshToken(rawToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should revoke token family AND throw UnauthorizedException if token was ALREADY USED (reuse detection)', async () => {
      mockJwtService.verify.mockReturnValue(validPayload);
      const usedRow = {
        user_id: 1,
        family_id: 'fam-valid',
        token_hash: hashedToken,
        used: true,
        expires_at: new Date(Date.now() + 100000),
      };
      mockPool.query.mockResolvedValueOnce({ rows: [usedRow], rowCount: 1 });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ revoked_at: null }],
        rowCount: 1,
      });
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await expect(service.validateRefreshToken(rawToken)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'UPDATE refresh_tokens SET revoked_at = NOW() WHERE family_id = $1',
        ),
        ['fam-valid'],
      );
    });

    it('should mark token as used and return userId and familyId on success', async () => {
      mockJwtService.verify.mockReturnValue(validPayload);
      const validRow = {
        user_id: 1,
        family_id: 'fam-valid',
        token_hash: hashedToken,
        used: false,
        expires_at: new Date(Date.now() + 100000),
      };
      mockPool.query.mockResolvedValueOnce({ rows: [validRow], rowCount: 1 });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ revoked_at: null }],
        rowCount: 1,
      });
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const result = await service.validateRefreshToken(rawToken);

      expect(result).toEqual({ userId: 1, familyId: 'fam-valid' });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'UPDATE refresh_tokens SET used = true WHERE id = $1',
        ),
        [10],
      );
    });
  });
});
