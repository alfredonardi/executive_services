import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CalendarProvider } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { EncryptionService } from '../../../common/encryption/encryption.service';
import { GoogleCalendarProvider } from '../providers/google/google-calendar.provider';
import { MicrosoftCalendarProvider } from '../providers/microsoft/microsoft-calendar.provider';
import { CalendarConnectionService } from '../services/calendar-connection.service';

describe('CalendarConnectionService', () => {
  let service: CalendarConnectionService;
  let prisma: jest.Mocked<PrismaService>;
  let googleProvider: jest.Mocked<GoogleCalendarProvider>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarConnectionService,
        {
          provide: PrismaService,
          useValue: {
            calendarConnection: {
              findUnique: jest.fn().mockResolvedValue(null),
            },
            oAuthState: {
              create: jest.fn().mockResolvedValue({}),
            },
            auditLog: {
              create: jest.fn().mockResolvedValue({}),
            },
          },
        },
        {
          provide: EncryptionService,
          useValue: {
            encrypt: jest.fn((value: string) => value),
            decrypt: jest.fn((value: string) => value),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'google.redirectUri') return 'https://default.example/google';
              if (key === 'microsoft.redirectUri') return 'https://default.example/microsoft';
              return null;
            }),
          },
        },
        {
          provide: GoogleCalendarProvider,
          useValue: {
            getAuthorizationUrl: jest.fn().mockReturnValue('https://accounts.google.com/auth'),
          },
        },
        {
          provide: MicrosoftCalendarProvider,
          useValue: {
            getAuthorizationUrl: jest.fn().mockReturnValue('https://login.microsoftonline.com/auth'),
          },
        },
      ],
    }).compile();

    service = module.get(CalendarConnectionService);
    prisma = module.get(PrismaService);
    googleProvider = module.get(GoogleCalendarProvider);
  });

  it('stores and uses a mobile redirect URI override during initiation', async () => {
    const redirectUri = 'executive-concierge://calendar/google';

    const result = await service.initiateConnection('user-1', CalendarProvider.GOOGLE, redirectUri);

    expect(prisma.oAuthState.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          provider: CalendarProvider.GOOGLE,
          redirectUri,
        }),
      }),
    );
    expect(googleProvider.getAuthorizationUrl).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      redirectUri,
    );
    expect(result.authorizationUrl).toBe('https://accounts.google.com/auth');
  });
});
