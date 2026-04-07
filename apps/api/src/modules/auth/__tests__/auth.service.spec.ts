import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../../prisma/prisma.service';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

jest.mock('otplib', () => ({
  authenticator: {
    verify: jest.fn(),
    generateSecret: jest.fn().mockReturnValue('TEST_SECRET'),
    keyuri: jest.fn().mockReturnValue('otpauth://test'),
  },
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,test'),
}));

import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser = {
    id: 'user-uuid-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: 'EXECUTIVE' as const,
    status: 'ACTIVE' as const,
    passwordHash: '$2a$12$hashedpassword',
    mfaEnabled: false,
    mfaSecret: null,
    mfaBackupCodes: [],
    nationality: null,
    company: null,
    title: null,
    timezone: 'America/Sao_Paulo',
    avatarUrl: null,
    preferences: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            refreshToken: {
              create: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            invitation: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            auditLog: {
              create: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config: Record<string, string> = {
                'jwt.accessSecret': 'test-secret',
                'jwt.accessExpiry': '15m',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);
  });

  describe('login', () => {
    it('should throw UnauthorizedException when user does not exist', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      await expect(
        service.login({ email: 'notfound@example.com', password: 'Password123!' }, {}),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      await expect(
        service.login({ email: 'test@example.com', password: 'WrongPassword' }, {}),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should issue tokens on successful login without MFA', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh-token');
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.login(
        { email: 'test@example.com', password: 'Password123!' },
        { ipAddress: '127.0.0.1' },
      );

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('tokenType', 'Bearer');
    });

    it('should return MFA challenge when MFA is enabled', async () => {
      const mfaUser = { ...mockUser, mfaEnabled: true };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mfaUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwtService.sign as jest.Mock).mockReturnValue('mfa-temp-token');
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.login(
        { email: 'test@example.com', password: 'Password123!' },
        {},
      );

      expect(result).toHaveProperty('requiresMfa', true);
      expect(result).toHaveProperty('mfaToken', 'mfa-temp-token');
    });

    it('should throw UnauthorizedException when user account is suspended', async () => {
      const suspendedUser = { ...mockUser, status: 'SUSPENDED' as const };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(suspendedUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.login({ email: 'test@example.com', password: 'Password123!' }, {}),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('registerFromInvite', () => {
    const mockInvitation = {
      id: 'invite-1',
      email: 'newuser@example.com',
      role: 'EXECUTIVE' as const,
      token: 'valid-invite-token',
      expiresAt: new Date(Date.now() + 86400000), // tomorrow
      acceptedAt: null,
      invitedById: 'admin-1',
      createdAt: new Date(),
    };

    it('should throw BadRequestException for invalid token', async () => {
      (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.registerFromInvite(
          {
            inviteToken: 'invalid',
            password: 'Password123!',
            firstName: 'New',
            lastName: 'User',
          },
          {},
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for expired invitation', async () => {
      const expiredInvitation = {
        ...mockInvitation,
        expiresAt: new Date(Date.now() - 86400000), // yesterday
      };
      (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(expiredInvitation);

      await expect(
        service.registerFromInvite(
          {
            inviteToken: 'valid-invite-token',
            password: 'Password123!',
            firstName: 'New',
            lastName: 'User',
          },
          {},
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should register user successfully with valid invitation', async () => {
      (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(mockInvitation);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      (prisma.$transaction as jest.Mock).mockResolvedValue([
        { ...mockUser, email: 'newuser@example.com' },
        mockInvitation,
      ]);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.registerFromInvite(
        {
          inviteToken: 'valid-invite-token',
          password: 'Password123!',
          firstName: 'New',
          lastName: 'User',
        },
        {},
      );

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });
});
