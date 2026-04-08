import type { ApiCalendarConnection, ApiCalendarSyncStatus, CalendarProvider } from './calendar.service';
import { apiClient } from './api.client';

export interface TodayEvent {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  provider: CalendarProvider | null;
  location: string | null;
  meetingUrl: string | null;
  isAllDay: boolean;
  status: 'upcoming' | 'in_progress' | 'completed';
}

export interface TodayWindow {
  startAt: string;
  endAt: string;
  durationMinutes: number;
  type: string;
  label: string;
}

export interface TodayOverview {
  date: string;
  timezone: string;
  firstName: string;
  hasCalendarConnection: boolean;
  needsInitialSync: boolean;
  scheduleDensity: 'low' | 'moderate' | 'high';
  summary: {
    meetingCount: number;
    freeWindowCount: number;
    opportunityWindowCount: number;
    hasMealOpportunity: boolean;
    hasEveningFree: boolean;
    nextMeetingStartsAt: string | null;
    lastMeetingEndsAt: string | null;
  };
  connections: ApiCalendarConnection[];
  syncStatus: ApiCalendarSyncStatus[];
  events: TodayEvent[];
  freeWindows: TodayWindow[];
  opportunityWindows: TodayWindow[];
}

export const todayService = {
  async getTodayOverview(): Promise<TodayOverview> {
    const response = await apiClient.get<TodayOverview>('/today');
    return response.data;
  },
};
