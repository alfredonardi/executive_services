import { MicrosoftCalendarProvider } from '../providers/microsoft/microsoft-calendar.provider';
import { ProviderTokenRevokedError, ProviderTransientError } from '../interfaces/calendar-provider.interface';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('MicrosoftCalendarProvider', () => {
  let provider: MicrosoftCalendarProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new MicrosoftCalendarProvider('test-client-id', 'test-client-secret');
  });

  // ─── Authorization URL ─────────────────────────────────────────────────────

  describe('getAuthorizationUrl', () => {
    it('should generate a valid Microsoft authorization URL with PKCE', () => {
      const url = provider.getAuthorizationUrl('test-state', 'code-challenge', 'http://redirect');

      expect(url).toContain('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('state=test-state');
      expect(url).toContain('code_challenge=code-challenge');
      expect(url).toContain('code_challenge_method=S256');
      expect(url).toContain('response_type=code');
      expect(url).toContain('offline_access'); // needed for refresh tokens
    });

    it('should include Calendars.Read and User.Read scopes', () => {
      const url = provider.getAuthorizationUrl('state', 'challenge', 'http://redirect');
      expect(url).toContain('Calendars.Read');
      expect(url).toContain('User.Read');
    });
  });

  // ─── Token Exchange ────────────────────────────────────────────────────────

  describe('exchangeCodeForTokens', () => {
    it('should exchange code for tokens and extract tenant ID', async () => {
      // Fake ID token with tenant ID
      const fakePayload = { tid: 'tenant-id-123', oid: 'user-oid' };
      const fakeIdToken = `header.${Buffer.from(JSON.stringify(fakePayload)).toString('base64url')}.sig`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'ms-access-token',
          refresh_token: 'ms-refresh-token',
          expires_in: 3600,
          scope: 'Calendars.Read User.Read offline_access',
          token_type: 'Bearer',
          id_token: fakeIdToken,
        }),
      });

      const result = await provider.exchangeCodeForTokens('auth-code', 'verifier', 'http://redirect');

      expect(result.accessToken).toBe('ms-access-token');
      expect(result.refreshToken).toBe('ms-refresh-token');
      expect(result.expiresInSeconds).toBe(3600);
      expect(result.tenantId).toBe('tenant-id-123');
    });

    it('should handle missing refresh_token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'ms-access-only',
          expires_in: 3600,
          scope: 'Calendars.Read',
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
          error_description: 'AADSTS70000: The request was denied.',
        }),
      });

      await expect(
        provider.exchangeCodeForTokens('bad-code', 'verifier', 'http://redirect'),
      ).rejects.toThrow(ProviderTokenRevokedError);
    });
  });

  // ─── Token Refresh ─────────────────────────────────────────────────────────

  describe('refreshAccessToken', () => {
    it('should refresh and return a new access token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-ms-access-token',
          refresh_token: 'new-ms-refresh-token',
          expires_in: 3600,
          scope: 'Calendars.Read User.Read offline_access',
          token_type: 'Bearer',
        }),
      });

      const result = await provider.refreshAccessToken('old-refresh-token');
      expect(result.accessToken).toBe('new-ms-access-token');
      expect(result.refreshToken).toBe('new-ms-refresh-token');
    });

    it('should throw ProviderTokenRevokedError when refresh token is revoked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'AADSTS70000: Refresh token revoked.',
        }),
      });

      await expect(provider.refreshAccessToken('revoked-refresh')).rejects.toThrow(
        ProviderTokenRevokedError,
      );
    });
  });

  // ─── Fetch Events ──────────────────────────────────────────────────────────

  describe('fetchEvents', () => {
    const mockMicrosoftEvent = {
      id: 'ms-event-id-1',
      subject: 'Executive Briefing',
      bodyPreview: 'Q2 financial results overview',
      start: { dateTime: '2026-04-07T10:00:00', timeZone: 'E. South America Standard Time' },
      end: { dateTime: '2026-04-07T11:00:00', timeZone: 'E. South America Standard Time' },
      location: { displayName: 'Av. Paulista, 1000, São Paulo' },
      isAllDay: false,
      isCancelled: false,
      organizer: { emailAddress: { address: 'ceo@company.com' } },
      attendees: [
        {
          emailAddress: { address: 'exec@company.com', name: 'Executive' },
          status: { response: 'accepted' },
        },
        {
          emailAddress: { address: 'advisor@company.com', name: 'Advisor' },
          status: { response: 'notResponded' },
        },
      ],
      onlineMeeting: { joinUrl: 'https://teams.microsoft.com/l/meetup-join/...' },
    };

    it('should fetch and normalize events for a full sync', async () => {
      // First call: calendarView, second call: delta initialization
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ value: [mockMicrosoftEvent] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ value: [], '@odata.deltaLink': 'https://graph.microsoft.com/delta-link' }),
        });

      const result = await provider.fetchEvents('valid-access-token', {
        timeMin: new Date('2026-04-01'),
        timeMax: new Date('2026-04-30'),
      });

      expect(result.events).toHaveLength(1);
      expect(result.nextSyncCursor).toContain('delta-link');

      const event = result.events[0]!;
      expect(event.externalId).toBe('ms-event-id-1');
      expect(event.title).toBe('Executive Briefing');
      expect(event.description).toBe('Q2 financial results overview');
      expect(event.isAllDay).toBe(false);
      expect(event.isCancelled).toBe(false);
      expect(event.organizer).toBe('ceo@company.com');
      expect(event.attendees).toHaveLength(2);
      expect(event.attendees[0]!.email).toBe('exec@company.com');
      expect(event.attendees[0]!.status).toBe('accepted');
      expect(event.attendees[1]!.status).toBe('needsAction');
      expect(event.meetingUrl).toContain('teams.microsoft.com');
    });

    it('should normalize all-day events', async () => {
      const allDayEvent = {
        ...mockMicrosoftEvent,
        id: 'all-day-ms',
        isAllDay: true,
        start: { dateTime: '2026-04-15T00:00:00', timeZone: 'UTC' },
        end: { dateTime: '2026-04-16T00:00:00', timeZone: 'UTC' },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ value: [allDayEvent] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ value: [], '@odata.deltaLink': 'delta' }),
        });

      const result = await provider.fetchEvents('token', {
        timeMin: new Date('2026-04-01'),
        timeMax: new Date('2026-04-30'),
      });

      expect(result.events[0]!.isAllDay).toBe(true);
    });

    it('should use deltaLink for incremental sync', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [],
          '@odata.deltaLink': 'https://graph.microsoft.com/new-delta',
        }),
      });

      const result = await provider.fetchEvents('access-token', {
        timeMin: new Date('2026-04-01'),
        timeMax: new Date('2026-04-30'),
        syncCursor: 'https://graph.microsoft.com/existing-delta',
      });

      const [fetchUrl] = mockFetch.mock.calls[0] as [string, ...unknown[]];
      expect(fetchUrl).toBe('https://graph.microsoft.com/existing-delta');
      expect(result.nextSyncCursor).toBe('https://graph.microsoft.com/new-delta');
    });

    it('should throw ProviderTransientError with status 410 when delta link expires', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 410,
        json: async () => ({
          error: { code: 'SyncStateNotFound', message: 'The delta link is no longer available.' },
        }),
      });

      await expect(
        provider.fetchEvents('token', {
          timeMin: new Date('2026-04-01'),
          timeMax: new Date('2026-04-30'),
          syncCursor: 'expired-delta',
        }),
      ).rejects.toThrow(ProviderTransientError);
    });

    it('should throw ProviderTokenRevokedError on 401', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: { code: 'InvalidAuthenticationToken', message: 'Access token has expired.' },
        }),
      });

      await expect(
        provider.fetchEvents('expired-token', {
          timeMin: new Date('2026-04-01'),
          timeMax: new Date('2026-04-30'),
        }),
      ).rejects.toThrow(ProviderTokenRevokedError);
    });

    it('should handle removed events (delta query tombstones)', async () => {
      const removedEvent = {
        id: 'deleted-event',
        '@removed': { reason: 'deleted' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [removedEvent],
          '@odata.deltaLink': 'new-delta',
        }),
      });

      const result = await provider.fetchEvents('token', {
        timeMin: new Date('2026-04-01'),
        timeMax: new Date('2026-04-30'),
        syncCursor: 'existing-delta',
      });

      expect(result.events[0]!.isCancelled).toBe(true);
    });

    it('should sanitize event title to 255 chars', async () => {
      const longTitleEvent = { ...mockMicrosoftEvent, subject: 'B'.repeat(1000) };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ value: [longTitleEvent] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ value: [], '@odata.deltaLink': 'delta' }),
        });

      const result = await provider.fetchEvents('token', {
        timeMin: new Date('2026-04-01'),
        timeMax: new Date('2026-04-30'),
      });

      expect(result.events[0]!.title.length).toBeLessThanOrEqual(255);
    });
  });

  // ─── Account Info ──────────────────────────────────────────────────────────

  describe('fetchAccountInfo', () => {
    it('should return email from mail field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          mail: 'exec@company.com',
          displayName: 'John Exec',
          userPrincipalName: 'john.exec@company.onmicrosoft.com',
        }),
      });

      const info = await provider.fetchAccountInfo('valid-token');
      expect(info.email).toBe('exec@company.com');
      expect(info.displayName).toBe('John Exec');
    });

    it('should fall back to userPrincipalName when mail is absent', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          userPrincipalName: 'exec@company.onmicrosoft.com',
          displayName: 'Exec User',
        }),
      });

      const info = await provider.fetchAccountInfo('token');
      expect(info.email).toBe('exec@company.onmicrosoft.com');
    });
  });
});
