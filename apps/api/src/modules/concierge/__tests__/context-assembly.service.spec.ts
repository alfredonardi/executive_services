import { Test, TestingModule } from '@nestjs/testing';
import { ContextAssemblyService } from '../services/context-assembly.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CalendarEventService } from '../../calendar/services/calendar-event.service';

const mockUser = {
  firstName: 'James',
  lastName: 'Richardson',
  timezone: 'America/Sao_Paulo',
  nationality: 'British',
  company: 'GlobalCorp',
  title: 'Chief Operating Officer',
};

const mockProfile = {
  foodPreferences: ['Japanese', 'Brazilian'],
  dietaryConstraints: ['gluten-free'],
  atmospherePreferences: ['quiet', 'private'],
  preferredNeighborhoods: ['Itaim Bibi', 'Vila Nova'],
  pacing: 'relaxed',
  wellnessInterest: true,
  additionalNotes: 'Prefers window seats',
};

const mockEvents = [
  {
    id: 'e1',
    title: 'Board Meeting',
    startAt: new Date(Date.now() + 60 * 60 * 1000), // 1h from now
    endAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    isAllDay: false,
    isCancelled: false,
    location: null,
    meetingUrl: null,
    provider: 'GOOGLE' as const,
  },
];

describe('ContextAssemblyService', () => {
  let service: ContextAssemblyService;
  let prisma: jest.Mocked<PrismaService>;
  let calendarEventService: jest.Mocked<CalendarEventService>;

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
      },
      preferenceProfile: {
        findUnique: jest.fn().mockResolvedValue(mockProfile),
      },
      recommendationSession: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const mockCalendarEventService = {
      getUpcomingEvents: jest.fn().mockResolvedValue(mockEvents),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextAssemblyService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CalendarEventService, useValue: mockCalendarEventService },
      ],
    }).compile();

    service = module.get<ContextAssemblyService>(ContextAssemblyService);
    prisma = module.get(PrismaService);
    calendarEventService = module.get(CalendarEventService);
  });

  describe('assemble', () => {
    it('should include user identity in context', async () => {
      const ctx = await service.assemble('user-1');
      expect(ctx.user.name).toBe('James Richardson');
      expect(ctx.user.title).toBe('Chief Operating Officer');
      expect(ctx.user.company).toBe('GlobalCorp');
      expect(ctx.user.nationality).toBe('British');
    });

    it('should include preference summary when profile exists', async () => {
      const ctx = await service.assemble('user-1');
      expect(ctx.user.preferencesSummary).toContain('Japanese');
      expect(ctx.user.preferencesSummary).toContain('gluten-free');
      expect(ctx.user.preferencesSummary).toContain('Itaim Bibi');
    });

    it('should include schedule context from calendar', async () => {
      const ctx = await service.assemble('user-1');
      expect(ctx.schedule).not.toBeNull();
      expect(ctx.schedule!.density).toBe('low'); // only 1 event
      expect(ctx.schedule!.nextMeetingAt).toBeDefined();
    });

    it('should return null schedule when calendar query fails', async () => {
      calendarEventService.getUpcomingEvents.mockRejectedValue(new Error('API error'));
      const ctx = await service.assemble('user-1');
      expect(ctx.schedule).toBeNull();
    });

    it('should return empty recommendations when no session exists', async () => {
      const ctx = await service.assemble('user-1');
      expect(ctx.recentRecommendations).toEqual([]);
    });

    it('should parse recent recommendations from session snapshot', async () => {
      const snapshot = [
        { title: 'Jun Sakamoto', category: 'RESTAURANT', neighborhood: 'Itaim Bibi' },
        { title: 'Espaço Haiti', category: 'WELLNESS', neighborhood: 'Jardins' },
      ];
      (prisma.recommendationSession.findFirst as jest.Mock).mockResolvedValue({
        resultsSnapshot: snapshot,
      });

      const ctx = await service.assemble('user-1');
      expect(ctx.recentRecommendations).toHaveLength(2);
      expect(ctx.recentRecommendations[0]!.title).toBe('Jun Sakamoto');
    });

    it('should gracefully handle missing user profile', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      const ctx = await service.assemble('user-1');
      expect(ctx.user.name).toBe('Executive');
      expect(ctx.user.timezone).toBe('America/Sao_Paulo');
    });

    it('should return context without preferencesSummary when no profile', async () => {
      (prisma.preferenceProfile.findUnique as jest.Mock).mockResolvedValue(null);
      const ctx = await service.assemble('user-1');
      expect(ctx.user.preferencesSummary).toBeUndefined();
    });
  });

  describe('renderForPrompt', () => {
    it('should produce a non-empty string for full context', async () => {
      const ctx = await service.assemble('user-1');
      const rendered = service.renderForPrompt(ctx);
      expect(rendered).toContain('James Richardson');
      expect(rendered).toContain('GlobalCorp');
      expect(rendered.length).toBeGreaterThan(50);
    });

    it('should include schedule density when schedule is present', async () => {
      const ctx = await service.assemble('user-1');
      const rendered = service.renderForPrompt(ctx);
      expect(rendered).toMatch(/low|moderate|high/);
    });

    it('should not crash when schedule is null', async () => {
      calendarEventService.getUpcomingEvents.mockRejectedValue(new Error('no calendar'));
      const ctx = await service.assemble('user-1');
      expect(() => service.renderForPrompt(ctx)).not.toThrow();
    });

    it('should not include raw event data or internal system fields', async () => {
      const ctx = await service.assemble('user-1');
      const rendered = service.renderForPrompt(ctx);
      // Should not leak IDs or raw database fields
      expect(rendered).not.toContain('connectionId');
      expect(rendered).not.toContain('userId');
    });
  });
});
