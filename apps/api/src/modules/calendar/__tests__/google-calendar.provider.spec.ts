import { GoogleCalendarProvider } from '../providers/google/google-calendar.provider';
import { ProviderTokenRevokedError, ProviderTransientError } from '../interfaces/calendar-provider.interface';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('GoogleCalendarProvider', () => {
  let provider: GoogleCalendarProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new GoogleCalendarProvider('test-client-id', 'test-client-secret');
  });

  // ─── Authorization URL ─────────────────────────────────────────────────────

  describe('getAuthorizationUrl', () => {
    it('should generate a valid authorization URL with PKCE params', () => {
      const url = provider.getAuthorizationUrl(
        'test-state',
        'test-code-challenge',
        'http://localhost:3000/callback',
      );

      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('state=test-state');
      expect(url).toContain('code_challenge=test-code-challenge');
      expect(url).toContain('code_challenge_method=S256');
      expect(url).toContain('access_type=offline');
      expect(url).toContain('prompt=consent');
      expect(url).toContain('response_type=code');
    });

    it('should include calendar read scope', () => {
      const url = provider.getAuthorizationUrl('state', 'challenge', 'http://redirect');
      expect(url).toContain('calendar.events.readonly');
    });
  });

  // ─── Token Exchange ────────────────────────────────────────────────────────

  describe('exchangeCodeForTokens', () => {
    it('should exchange code for tokens successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'access-token-123',
          refresh_token: 'refresh-token-456',
          expires_in: 3600,
          scope: 'https://www.googleapis.com/auth/calendar.events.readonly',
          token_type: 'Bearer',
        }),
      });

      const result = await provider.exchangeCodeForTokens(
        'auth-code',
        'code-verifier',
        'http://localhost:3000/callback',
      );

      expect(result.accessToken).toBe('access-token-123');
      expect(result.refreshToken).toBe('refresh-token-456');
      expect(result.expiresInSeconds).toBe(3600);
      expect(result.scopes).toContain('https://www.googleapis.com/auth/calendar.events.readonly');
    });

    it('should handle missing refresh_token gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'access-token-only',
          expires_in: 3600,
          scope: 'calendar.events.readonly',
          token_type: 'Bearer',
        }),
      });

      const result = await provider.exchangeCodeForTokens('code', 'verifier', 'http://redirect');
      expect(result.refreshToken).toBeNull();
    });

    it('should throw ProviderTokenRevokedError on invalid_grant', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Token has been expired or revoked.',
        }),
      });

      await expect(
        provider.exchangeCodeForTokens('bad-code', 'verifier', 'http://redirect'),
      ).rejects.toThrow(ProviderTokenRevokedError);
    });

    it('should throw ProviderTransientError on 500 from Google', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'backend_error', error_description: 'Service unavailable' }),
      });

      await expect(
        provider.exchangeCodeForTokens('code', 'verifier', 'http://redirect'),
      ).rejects.toThrow(ProviderTransientError);
    });
  });

  // ─── Token Refresh ─────────────────────────────────────────────────────────

  describe('refreshAccessToken', () => {
    it('should refresh token and return new access token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          expires_in: 3600,
          scope: 'calendar.events.readonly',
          token_type: 'Bearer',
        }),
      });

      const result = await provider.refreshAccessToken('existing-refresh-token');

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBeNull(); // Google doesn't return new refresh token
      expect(result.expiresInSeconds).toBe(3600);
    });

    it('should throw ProviderTokenRevokedError when refresh token is revoked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Token has been revoked.',
        }),
      });

      await expect(provider.refreshAccessToken('revoked-token')).rejects.toThrow(
        ProviderTokenRevokedError,
      );
    });
  });

  // ─── Fetch Events ──────────────────────────────────────────────────────────

  describe('fetchEvents', () => {
    const mockGoogleEvent = {
      id: 'event-id-1',
      summary: 'Board Meeting',
      description: 'Q2 review',
      start: { dateTime: '2026-04-07T14:00:00Z', timeZone: 'America/Sao_Paulo' },
      end: { dateTime: '2026-04-07T15:30:00Z', timeZone: 'America/Sao_Paulo' },
      location: 'Paulista Avenue 1000',
      status: 'confirmed',
      organizer: { email: 'organizer@company.com' },
      attendees: [
        { email: 'exec@company.com', displayName: 'Executive', responseStatus: 'accepted' },
        { email: 'cfo@company.com', displayName: 'CFO', responseStatus: 'tentativelyAccepted' },
      ],
    };

    it('should fetch and normalize events for a full sync', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [mockGoogleEvent],
          nextSyncToken: 'next-sync-token-abc',
        }),
      });

      const result = await provider.fetchEvents('valid-access-token', {
        timeMin: new Date('2026-04-01'),
        timeMax: new Date('2026-04-30'),
      });

      expect(result.events).toHaveLength(1);
      expect(result.nextSyncCursor).toBe('next-sync-token-abc');

      const event = result.events[0]!;
      expect(event.externalId).toBe('event-id-1');
      expect(event.title).toBe('Board Meeting');
      expect(event.description).toBe('Q2 review');
      expect(event.isAllDay).toBe(false);
      expect(event.isCancelled).toBe(false);
      expect(event.organizer).toBe('organizer@company.com');
      expect(event.attendees).toHaveLength(2);
      expect(event.attendees[0]!.email).toBe('exec@company.com');
      expect(event.attendees[0]!.status).toBe('accepted');
    });

    it('should normalize all-day events correctly', async () => {
      const allDayEvent = {
        ...mockGoogleEvent,
        id: 'all-day-1',
        start: { date: '2026-04-15' },
        end: { date: '2026-04-16' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [allDayEvent] }),
      });

      const result = await provider.fetchEvents('access-token', {
        timeMin: new Date('2026-04-01'),
        timeMax: new Date('2026-04-30'),
      });

      expect(result.events[0]!.isAllDay).toBe(true);
    });

    it('should normalize cancelled events', async () => {
      const cancelledEvent = { ...mockGoogleEvent, id: 'cancelled-1', status: 'cancelled' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [cancelledEvent] }),
      });

      const result = await provider.fetchEvents('access-token', {
        timeMin: new Date('2026-04-01'),
        timeMax: new Date('2026-04-30'),
      });

      expect(result.events[0]!.isCancelled).toBe(true);
    });

    it('should use syncCursor for incremental sync', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [],
          nextSyncToken: 'newer-sync-token',
        }),
      });

      const result = await provider.fetchEvents('access-token', {
        timeMin: new Date('2026-04-01'),
        timeMax: new Date('2026-04-30'),
        syncCursor: 'existing-sync-token',
      });

      // Verify the URL uses syncToken parameter
      const [fetchUrl] = mockFetch.mock.calls[0] as [string, ...unknown[]];
      expect(fetchUrl).toContain('syncToken=existing-sync-token');
      expect(result.nextSyncCursor).toBe('newer-sync-token');
    });

    it('should throw ProviderTransientError with status 410 when sync token is expired', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 410,
        json: async () => ({ error: { code: 410, message: 'Sync token is no longer valid.' } }),
      });

      await expect(
        provider.fetchEvents('access-token', {
          timeMin: new Date('2026-04-01'),
          timeMax: new Date('2026-04-30'),
          syncCursor: 'expired-sync-token',
        }),
      ).rejects.toThrow(ProviderTransientError);
    });

    it('should extract Google Meet URL from hangoutLink', async () => {
      const eventWithMeet = {
        ...mockGoogleEvent,
        id: 'meet-event-1',
        hangoutLink: 'https://meet.google.com/abc-defg-hij',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [eventWithMeet] }),
      });

      const result = await provider.fetchEvents('access-token', {
        timeMin: new Date('2026-04-01'),
        timeMax: new Date('2026-04-30'),
      });

      expect(result.events[0]!.meetingUrl).toBe('https://meet.google.com/abc-defg-hij');
    });

    it('should throw ProviderTokenRevokedError on 401', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'unauthorized', error_description: 'Invalid credentials' }),
      });

      await expect(
        provider.fetchEvents('expired-token', {
          timeMin: new Date('2026-04-01'),
          timeMax: new Date('2026-04-30'),
        }),
      ).rejects.toThrow(ProviderTokenRevokedError);
    });

    it('should sanitize excessively long event titles', async () => {
      const eventWithLongTitle = {
        ...mockGoogleEvent,
        id: 'long-title',
        summary: 'A'.repeat(1000),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [eventWithLongTitle] }),
      });

      const result = await provider.fetchEvents('access-token', {
        timeMin: new Date('2026-04-01'),
        timeMax: new Date('2026-04-30'),
      });

      expect(result.events[0]!.title.length).toBeLessThanOrEqual(255);
    });

    it('should return empty events array when provider returns no items', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [], nextSyncToken: 'token' }),
      });

      const result = await provider.fetchEvents('access-token', {
        timeMin: new Date('2026-04-01'),
        timeMax: new Date('2026-04-30'),
      });

      expect(result.events).toHaveLength(0);
    });
  });

  // ─── Account Info ──────────────────────────────────────────────────────────

  describe('fetchAccountInfo', () => {
    it('should return user email and display name', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          email: 'user@gmail.com',
          name: 'John Doe',
        }),
      });

      const info = await provider.fetchAccountInfo('valid-token');
      expect(info.email).toBe('user@gmail.com');
      expect(info.displayName).toBe('John Doe');
    });
  });
});
