import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserService } from '../user.service';

describe('UserService', () => {
  let service: UserService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUniqueOrThrow: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get(UserService);
    prisma = module.get(PrismaService);
  });

  it('normalizes missing account preferences on profile fetch', async () => {
    (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'ana@example.com',
      firstName: 'Ana',
      lastName: 'Silva',
      role: 'EXECUTIVE',
      status: 'ACTIVE',
      company: 'Acme',
      title: 'CEO',
      timezone: 'America/Sao_Paulo',
      avatarUrl: null,
      preferences: {},
    });

    const result = await service.getProfile('user-1');

    expect(result.preferences).toEqual({
      languages: [],
      communicationStyle: 'BRIEF',
      notificationsEnabled: true,
    });
  });

  it('merges account preference updates with stored values', async () => {
    (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      preferences: {
        languages: ['English'],
        communicationStyle: 'DETAILED',
        notificationsEnabled: false,
      },
    });
    (prisma.user.update as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'ana@example.com',
      firstName: 'Ana',
      lastName: 'Silva',
      role: 'EXECUTIVE',
      status: 'ACTIVE',
      company: 'Acme',
      title: 'CEO',
      timezone: 'America/New_York',
      avatarUrl: null,
      preferences: {
        languages: ['English', 'Portuguese'],
        communicationStyle: 'DETAILED',
        notificationsEnabled: true,
      },
    });

    const result = await service.updateProfile('user-1', {
      timezone: 'America/New_York',
      languages: ['English', 'Portuguese'],
      notificationsEnabled: true,
    });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          timezone: 'America/New_York',
          preferences: {
            languages: ['English', 'Portuguese'],
            communicationStyle: 'DETAILED',
            notificationsEnabled: true,
          },
        }),
      }),
    );
    expect(result.preferences.notificationsEnabled).toBe(true);
    expect(result.preferences.communicationStyle).toBe('DETAILED');
  });
});
