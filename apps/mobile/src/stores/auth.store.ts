import { create } from 'zustand';
import { authService } from '../services/auth.service';
import { tokenStorage } from '../services/api.client';
import type { User } from '@executive/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  requiresMfa: boolean;
  mfaToken: string | null;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  verifyMfa: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  clearError: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  requiresMfa: false,
  mfaToken: null,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.login({ email, password });

      if (response.requiresMfa && response.mfaToken) {
        set({
          requiresMfa: true,
          mfaToken: response.mfaToken,
          isLoading: false,
        });
      } else if (response.accessToken) {
        // Will fetch user profile after login
        set({
          isAuthenticated: true,
          requiresMfa: false,
          mfaToken: null,
          isLoading: false,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  verifyMfa: async (code: string) => {
    const { mfaToken } = get();
    if (!mfaToken) throw new Error('No MFA token');

    set({ isLoading: true, error: null });
    try {
      await authService.verifyMfa({ mfaToken, code });
      set({
        isAuthenticated: true,
        requiresMfa: false,
        mfaToken: null,
        isLoading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'MFA verification failed';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authService.logout();
    } finally {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        requiresMfa: false,
        mfaToken: null,
        error: null,
      });
    }
  },

  setUser: (user: User) => set({ user }),

  clearError: () => set({ error: null }),

  checkAuth: async () => {
    const token = await tokenStorage.getAccessToken();
    if (!token) {
      set({ isAuthenticated: false });
      return;
    }
    set({ isAuthenticated: true });
  },
}));
