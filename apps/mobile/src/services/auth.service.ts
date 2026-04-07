import { apiClient, tokenStorage } from './api.client';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  requiresMfa?: boolean;
  mfaToken?: string;
}

export interface MfaVerifyRequest {
  mfaToken: string;
  code: string;
}

export interface RegisterRequest {
  inviteToken: string;
  password: string;
  firstName: string;
  lastName: string;
}

export const authService = {
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/auth/login', data);

    if (!response.data.requiresMfa && response.data.accessToken) {
      await tokenStorage.setAccessToken(response.data.accessToken);
      if (response.data.refreshToken) {
        await tokenStorage.setRefreshToken(response.data.refreshToken);
      }
    }

    return response.data;
  },

  async verifyMfa(data: MfaVerifyRequest): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/auth/mfa/verify', data);

    if (response.data.accessToken) {
      await tokenStorage.setAccessToken(response.data.accessToken);
      if (response.data.refreshToken) {
        await tokenStorage.setRefreshToken(response.data.refreshToken);
      }
    }

    return response.data;
  },

  async register(data: RegisterRequest): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/auth/register', data);

    if (response.data.accessToken) {
      await tokenStorage.setAccessToken(response.data.accessToken);
      if (response.data.refreshToken) {
        await tokenStorage.setRefreshToken(response.data.refreshToken);
      }
    }

    return response.data;
  },

  async logout(): Promise<void> {
    const refreshToken = await tokenStorage.getRefreshToken();
    try {
      await apiClient.post('/auth/logout', { refreshToken });
    } catch {
      // Logout even if request fails
    } finally {
      await tokenStorage.clearTokens();
    }
  },

  async setupMfa(): Promise<{ secret: string; qrCodeUrl: string }> {
    const response = await apiClient.post<{ secret: string; qrCodeUrl: string }>('/auth/mfa/setup');
    return response.data;
  },

  async confirmMfa(code: string): Promise<void> {
    await apiClient.post('/auth/mfa/confirm', { code });
  },
};
