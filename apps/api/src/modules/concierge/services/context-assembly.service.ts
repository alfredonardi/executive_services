import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CalendarEventService } from '../../calendar/services/calendar-event.service';

interface CalendarEventSnapshot {
  id: string;
  title: string | null;
  startAt: Date;
  endAt: Date;
  isAllDay: boolean;
  isCancelled: boolean;
  location?: string | null;
  meetingUrl?: string | null;
}

export interface ConciergeContext {
  user: {
    name: string;
    timezone: string;
    nationality?: string;
    company?: string;
    title?: string;
    preferencesSummary?: string;
  };
  schedule: {
    date: string;
    density: 'low' | 'moderate' | 'high';
    nextMeetingAt?: string;
    upcomingEventTitles: string[];
    freeWindowsSummary: string;
    hasMealOpportunity: boolean;
    hasEveningFree: boolean;
  } | null;
  recentRecommendations: {
    title: string;
    category: string;
    neighborhood: string;
  }[];
}

const SAO_PAULO_TZ = 'America/Sao_Paulo';

@Injectable()
export class ContextAssemblyService {
  private readonly logger = new Logger(ContextAssemblyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calendarEventService: CalendarEventService,
  ) {}

  async assemble(userId: string): Promise<ConciergeContext> {
    const [user, profile, schedule, recentRecs] = await Promise.allSettled([
      this.fetchUser(userId),
      this.fetchPreferences(userId),
      this.fetchScheduleContext(userId),
      this.fetchRecentRecommendations(userId),
    ]);

    const userData = user.status === 'fulfilled' ? user.value : null;
    const profileData = profile.status === 'fulfilled' ? profile.value : null;
    const scheduleData = schedule.status === 'fulfilled' ? schedule.value : null;
    const recsData = recentRecs.status === 'fulfilled' ? recentRecs.value : [];

    if (user.status === 'rejected') {
      this.logger.warn(`Failed to fetch user context for ${userId}: ${String(user.reason)}`);
    }

    return {
      user: {
        name: userData ? `${userData.firstName} ${userData.lastName}` : 'Executive',
        timezone: userData?.timezone ?? SAO_PAULO_TZ,
        nationality: userData?.nationality ?? undefined,
        company: userData?.company ?? undefined,
        title: userData?.title ?? undefined,
        preferencesSummary: this.buildPreferenceSummary(profileData),
      },
      schedule: scheduleData,
      recentRecommendations: recsData,
    };
  }

  /**
   * Render context as a concise natural-language block for inclusion in AI prompts.
   * Keeps tokens low and avoids raw PII fields.
   */
  renderForPrompt(ctx: ConciergeContext): string {
    const lines: string[] = [];

    lines.push(`Client: ${ctx.user.name}${ctx.user.title ? `, ${ctx.user.title}` : ''}${ctx.user.company ? ` at ${ctx.user.company}` : ''}.`);
    if (ctx.user.nationality) lines.push(`Nationality: ${ctx.user.nationality}.`);
    if (ctx.user.preferencesSummary) lines.push(`Preferences: ${ctx.user.preferencesSummary}.`);

    if (ctx.schedule) {
      lines.push(`Today (${ctx.schedule.date}): Schedule is ${ctx.schedule.density}.`);
      if (ctx.schedule.upcomingEventTitles.length > 0) {
        lines.push(`Upcoming today: ${ctx.schedule.upcomingEventTitles.slice(0, 3).join(', ')}.`);
      }
      if (ctx.schedule.nextMeetingAt) {
        lines.push(`Next meeting starts at: ${ctx.schedule.nextMeetingAt}.`);
      }
      lines.push(`Free time: ${ctx.schedule.freeWindowsSummary}.`);
      if (ctx.schedule.hasMealOpportunity) lines.push('Has a lunch window available.');
      if (ctx.schedule.hasEveningFree) lines.push('Has a free evening.');
    }

    if (ctx.recentRecommendations.length > 0) {
      const recList = ctx.recentRecommendations
        .slice(0, 3)
        .map((r) => `${r.title} (${r.category}, ${r.neighborhood})`)
        .join('; ');
      lines.push(`Recent recommendations surfaced: ${recList}.`);
    }

    return lines.join(' ');
  }

  private async fetchUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        timezone: true,
        nationality: true,
        company: true,
        title: true,
      },
    });
  }

  private async fetchPreferences(userId: string) {
    return this.prisma.preferenceProfile.findUnique({
      where: { userId },
      select: {
        foodPreferences: true,
        dietaryConstraints: true,
        atmospherePreferences: true,
        preferredNeighborhoods: true,
        pacing: true,
        wellnessInterest: true,
        additionalNotes: true,
      },
    });
  }

  private async fetchScheduleContext(userId: string): Promise<ConciergeContext['schedule']> {
    try {
      const now = new Date();
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(now);
      dayEnd.setHours(23, 59, 59, 999);

      const rawEvents = await this.calendarEventService.getUpcomingEvents({
        userId,
        from: dayStart,
        to: dayEnd,
        limit: 10,
      });

      const events = rawEvents as CalendarEventSnapshot[];

      const timed = events
        .filter((e: CalendarEventSnapshot) => !e.isAllDay && !e.isCancelled)
        .sort((a: CalendarEventSnapshot, b: CalendarEventSnapshot) => a.startAt.getTime() - b.startAt.getTime());

      const count = timed.length;
      const density: 'low' | 'moderate' | 'high' =
        count < 2 ? 'low' : count <= 4 ? 'moderate' : 'high';

      const nextMeeting = timed.find((e: CalendarEventSnapshot) => e.startAt > now);
      const nextMeetingAt = nextMeeting
        ? nextMeeting.startAt.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: SAO_PAULO_TZ,
          })
        : undefined;

      const upcomingEventTitles = timed
        .filter((e: CalendarEventSnapshot) => e.startAt >= now)
        .map((e: CalendarEventSnapshot) => e.title ?? 'Meeting')
        .slice(0, 5);

      // Rough free-window summary from gaps
      const freeMinutes = this.estimateFreeMinutes(timed, dayStart, dayEnd);
      const hasMealOpportunity = this.checkMealOpportunity(timed);
      const hasEveningFree = this.checkEveningFree(timed);

      const freeWindowsSummary =
        freeMinutes > 0
          ? `approximately ${freeMinutes} free minutes across the day`
          : 'fully booked today';

      return {
        date: now.toISOString().split('T')[0]!,
        density,
        nextMeetingAt,
        upcomingEventTitles,
        freeWindowsSummary,
        hasMealOpportunity,
        hasEveningFree,
      };
    } catch (err) {
      this.logger.warn(`Schedule context unavailable for ${userId}: ${String(err)}`);
      return null;
    }
  }

  private async fetchRecentRecommendations(
    userId: string,
  ): Promise<ConciergeContext['recentRecommendations']> {
    const session = await this.prisma.recommendationSession.findFirst({
      where: { userId },
      orderBy: { requestedAt: 'desc' },
      select: { resultsSnapshot: true },
    });

    if (!session?.resultsSnapshot) return [];

    try {
      const snapshot = session.resultsSnapshot as unknown as Array<{
        title?: string;
        category?: string;
        neighborhood?: string;
      }>;

      return snapshot.slice(0, 5).map((item) => ({
        title: item.title ?? 'Recommendation',
        category: item.category ?? 'GENERAL',
        neighborhood: item.neighborhood ?? 'São Paulo',
      }));
    } catch {
      return [];
    }
  }

  private buildPreferenceSummary(
    profile: {
      foodPreferences: string[];
      dietaryConstraints: string[];
      atmospherePreferences: string[];
      preferredNeighborhoods: string[];
      pacing: string | null;
      wellnessInterest: boolean | null;
      additionalNotes: string | null;
    } | null,
  ): string | undefined {
    if (!profile) return undefined;

    const parts: string[] = [];
    if (profile.foodPreferences.length > 0) {
      parts.push(`food: ${profile.foodPreferences.join(', ')}`);
    }
    if (profile.dietaryConstraints.length > 0) {
      parts.push(`dietary: ${profile.dietaryConstraints.join(', ')}`);
    }
    if (profile.atmospherePreferences.length > 0) {
      parts.push(`atmosphere: ${profile.atmospherePreferences.join(', ')}`);
    }
    if (profile.preferredNeighborhoods.length > 0) {
      parts.push(`preferred areas: ${profile.preferredNeighborhoods.join(', ')}`);
    }
    if (profile.pacing) parts.push(`pacing: ${profile.pacing}`);
    if (profile.wellnessInterest) parts.push('interested in wellness');
    if (profile.additionalNotes) parts.push(profile.additionalNotes);

    return parts.length > 0 ? parts.join('; ') : undefined;
  }

  private estimateFreeMinutes(
    events: CalendarEventSnapshot[],
    dayStart: Date,
    dayEnd: Date,
  ): number {
    const totalDay = (dayEnd.getTime() - dayStart.getTime()) / 60_000;
    const occupied = events.reduce(
      (sum: number, e: CalendarEventSnapshot) => sum + (e.endAt.getTime() - e.startAt.getTime()) / 60_000,
      0,
    );
    return Math.max(0, Math.round(totalDay - occupied));
  }

  private checkMealOpportunity(events: CalendarEventSnapshot[]): boolean {
    // Check if 11:30-14:30 has >= 45 min free
    const mealStart = new Date();
    mealStart.setHours(11, 30, 0, 0);
    const mealEnd = new Date();
    mealEnd.setHours(14, 30, 0, 0);

    const overlapping = events.filter(
      (e: CalendarEventSnapshot) => e.startAt < mealEnd && e.endAt > mealStart,
    );
    const occupiedInWindow = overlapping.reduce((sum: number, e: CalendarEventSnapshot) => {
      const start = Math.max(e.startAt.getTime(), mealStart.getTime());
      const end = Math.min(e.endAt.getTime(), mealEnd.getTime());
      return sum + (end - start) / 60_000;
    }, 0);

    const windowMinutes = (mealEnd.getTime() - mealStart.getTime()) / 60_000;
    return windowMinutes - occupiedInWindow >= 45;
  }

  private checkEveningFree(events: CalendarEventSnapshot[]): boolean {
    const eveningStart = new Date();
    eveningStart.setHours(19, 0, 0, 0);
    const eveningEnd = new Date();
    eveningEnd.setHours(22, 0, 0, 0);

    const hasEveningMeeting = events.some(
      (e: CalendarEventSnapshot) => e.startAt < eveningEnd && e.endAt > eveningStart,
    );
    return !hasEveningMeeting;
  }
}
