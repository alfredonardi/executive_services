import { apiClient } from './api.client';

export type NotificationType =
  | 'REQUEST_UPDATE'
  | 'MESSAGE'
  | 'RECOMMENDATION'
  | 'SYSTEM'
  | 'REMINDER';

export interface ApiNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export const notificationService = {
  async listNotifications(unreadOnly = false): Promise<ApiNotification[]> {
    const qs = unreadOnly ? '?unreadOnly=true' : '';
    const response = await apiClient.get<ApiNotification[]>(`/notifications${qs}`);
    return response.data;
  },

  async markAsRead(id: string): Promise<void> {
    await apiClient.patch(`/notifications/${id}/read`);
  },

  async markAllAsRead(): Promise<void> {
    await apiClient.post('/notifications/read-all');
  },
};
