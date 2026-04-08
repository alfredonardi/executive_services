import { apiClient } from './api.client';

export type CalendarProvider = 'GOOGLE' | 'MICROSOFT';

export interface ApiCalendarConnection {
  id: string;
  provider: CalendarProvider;
  email: string | null;
  isActive: boolean;
  syncedAt: string | null;
  createdAt: string;
}

export interface ApiCalendarSyncStatus {
  connectionId: string;
  provider: CalendarProvider;
  lastSyncedAt: string | null;
  lastAttempt: {
    status: string;
    eventsAdded: number;
    eventsUpdated: number;
    eventsRemoved: number;
    errorMessage: string | null;
    createdAt: string;
  } | null;
}

export interface ConnectCalendarResponse {
  authorizationUrl: string;
  state: string;
}

export interface CompleteCalendarConnectionResponse {
  connectionId: string;
  provider: CalendarProvider;
  email: string | null;
}

export const calendarService = {
  async listConnections(): Promise<ApiCalendarConnection[]> {
    const response = await apiClient.get<ApiCalendarConnection[]>('/calendar/connections');
    return response.data;
  },

  async getSyncStatus(): Promise<ApiCalendarSyncStatus[]> {
    const response = await apiClient.get<ApiCalendarSyncStatus[]>('/calendar/status');
    return response.data;
  },

  async initiateConnection(
    provider: CalendarProvider,
    redirectUri?: string,
  ): Promise<ConnectCalendarResponse> {
    const path = provider === 'GOOGLE' ? 'google' : 'microsoft';
    const response = await apiClient.post<ConnectCalendarResponse>(
      `/calendar/${path}/connect`,
      redirectUri ? { redirectUri } : {},
    );
    return response.data;
  },

  async completeConnection(
    provider: CalendarProvider,
    code: string,
    state: string,
  ): Promise<CompleteCalendarConnectionResponse> {
    const path = provider === 'GOOGLE' ? 'google' : 'microsoft';
    const response = await apiClient.get<CompleteCalendarConnectionResponse>(
      `/calendar/${path}/callback`,
      {
        params: { code, state },
      },
    );
    return response.data;
  },

  async syncConnection(connectionId: string): Promise<void> {
    await apiClient.post(`/calendar/connections/${connectionId}/sync`);
  },

  async disconnect(connectionId: string): Promise<void> {
    await apiClient.delete(`/calendar/connections/${connectionId}`);
  },
};
