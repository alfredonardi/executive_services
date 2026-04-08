import { apiClient } from './api.client';

export interface AccountPreferences {
  languages: string[];
  communicationStyle: 'BRIEF' | 'DETAILED';
  notificationsEnabled: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'EXECUTIVE' | 'CONCIERGE_AGENT' | 'ADMIN';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  company: string | null;
  title: string | null;
  timezone: string;
  avatarUrl: string | null;
  preferences: AccountPreferences;
}

export interface UpdateUserProfileDto {
  firstName?: string;
  lastName?: string;
  company?: string;
  title?: string;
  timezone?: string;
  languages?: string[];
  communicationStyle?: 'BRIEF' | 'DETAILED';
  notificationsEnabled?: boolean;
}

export const profileService = {
  async getProfile(): Promise<UserProfile> {
    const response = await apiClient.get<UserProfile>('/me');
    return response.data;
  },

  async updateProfile(dto: UpdateUserProfileDto): Promise<UserProfile> {
    const response = await apiClient.patch<UserProfile>('/me', dto);
    return response.data;
  },
};
