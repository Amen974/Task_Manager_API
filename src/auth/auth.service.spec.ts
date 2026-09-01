import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../users/user.service';
import { RefreshTokenService } from './refresh-token.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let mockUserService: { getUserByEmail: jest.Mock; insertUser: jest.Mock };
  let mockRefreshTokenService: {
    createRefreshToken: jest.Mock;
    deleteToken: jest.Mock;
  };
  let mockJwtService: { sign: jest.Mock; verify: jest.Mock };
  let mockConfigService: { get: jest.Mock };

  beforeEach(async () => {
    mockUserService = {
      getUserByEmail: jest.fn(),
      insertUser: jest.fn(),
    };
    mockRefreshTokenService = {
      createRefreshToken: jest.fn(),
      deleteToken: jest.fn(),
    };
    mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'REFRESH_TOKEN_SECRET') return 'test-refresh-secret';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: mockUserService },
        { provide: RefreshTokenService, useValue: mockRefreshTokenService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTokens', () => {
    it('should generate access and refresh tokens', async () => {
      mockJwtService.sign.mockReturnValue('access.jwt.token');
      mockRefreshTokenService.createRefreshToken.mockResolvedValue(
        'refresh.jwt.token',
      );

      const result = await service.createTokens(1, 'fam-123');

      expect(mockJwtService.sign).toHaveBeenCalledWith({ sub: 1 });
      expect(mockRefreshTokenService.createRefreshToken).toHaveBeenCalledWith(
        1,
        'fam-123',
      );
      expect(result).toEqual({
        access_token: 'access.jwt.token',
        refresh_token: 'refresh.jwt.token',
      });
    });
  });

  describe('createUser', () => {
    const registerDto = {
      email: 'newuser@example.com',
      password: 'password123',
      name: 'New User',
    };

    it('should throw ConflictException if user email already exists', async () => {
      mockUserService.getUserByEmail.mockResolvedValue({
        id: 1,
        email: 'newuser@example.com',
      });

      await expect(service.createUser(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockUserService.insertUser).not.toHaveBeenCalled();
    });

    it('should hash password, insert user, create tokens, and return them', async () => {
      mockUserService.getUserByEmail.mockResolvedValue(null);
      mockUserService.insertUser.mockResolvedValue({ id: 5 });
      mockJwtService.sign.mockReturnValue('access.jwt.token');
      mockRefreshTokenService.createRefreshToken.mockResolvedValue(
        'refresh.jwt.token',
      );

      const result = await service.createUser(registerDto);

      expect(mockUserService.insertUser).toHaveBeenCalledWith(
        'newuser@example.com',
        expect.any(String), // hashed password
        'New User',
      );
      expect(result).toEqual({
        access_token: 'access.jwt.token',
        refresh_token: 'refresh.jwt.token',
      });
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'user@example.com',
      password: 'password123',
    };

    it('should throw UnauthorizedException if no user is found with email', async () => {
      mockUserService.getUserByEmail.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      const hashedPassword = bcrypt.hashSync('correctpassword', 10);
      mockUserService.getUserByEmail.mockResolvedValue({
        id: 1,
        email: 'user@example.com',
        password_hash: hashedPassword,
      });

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return tokens if email exists and password matches', async () => {
      const hashedPassword = bcrypt.hashSync('password123', 10);
      mockUserService.getUserByEmail.mockResolvedValue({
        id: 1,
        email: 'user@example.com',
        password_hash: hashedPassword,
      });
      mockJwtService.sign.mockReturnValue('access.jwt.token');
      mockRefreshTokenService.createRefreshToken.mockResolvedValue(
        'refresh.jwt.token',
      );

      const result = await service.login(loginDto);

      expect(result).toEqual({
        access_token: 'access.jwt.token',
        refresh_token: 'refresh.jwt.token',
      });
    });
  });

  describe('logout', () => {
    it('should throw UnauthorizedException if refresh token validation/verification fails', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(service.logout('bad.token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockRefreshTokenService.deleteToken).not.toHaveBeenCalled();
    });

    it('should delete token family when refresh token verification succeeds', async () => {
      mockJwtService.verify.mockReturnValue({
        id: 10,
        userId: 1,
        family_id: 'family-xyz',
      });
      mockRefreshTokenService.deleteToken.mockResolvedValue(undefined);

      await service.logout('valid.refresh.token');

      expect(mockJwtService.verify).toHaveBeenCalledWith(
        'valid.refresh.token',
        {
          secret: 'test-refresh-secret',
        },
      );
      expect(mockRefreshTokenService.deleteToken).toHaveBeenCalledWith(
        'family-xyz',
      );
    });
  });
});
