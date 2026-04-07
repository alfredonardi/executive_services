import { Injectable, Logger } from '@nestjs/common';
import {
  AccountInfo,
  FetchEventsOptions,
  ICalendarProvider,
  ProviderTokenRevokedError,
  ProviderTransientError,
  TokenResponse,
} from '../../interfaces/calendar-provider.interface';
import {
  NormalizedAttendee,
  NormalizedCalendarEvent,
  ProviderEventPage,
} from '../../domain/calendar-event.model';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const GOOGLE_CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface GoogleEventDateTime {
  dateTime?: string;
  date?: string;
  timeZone?: string;
}

interface GoogleAttendee {
  email?: string;
  displayName?: string;
  responseStatus?: string;
}

interface GoogleConferenceSolution {
  name?: string;
}

interface GoogleConferenceData {
  conferenceSolution?: GoogleConferenceSolution;
  entryPoints?: Array<{ entryPointType: string; uri: string }>;
}

interface GoogleEvent {
  id?: string;
  summary?: string;
  description?: string;
  start?: GoogleEventDateTime;
  end?: GoogleEventDateTime;
  location?: string;
  status?: string;
  organizer?: { email?: string };
  attendees?: GoogleAttendee[];
  conferenceData?: GoogleConferenceData;
  hangoutLink?: string;
}

interface GoogleEventsListResponse {
  items?: GoogleEvent[];
  nextSyncToken?: string;
  nextPageToken?: string;
}

/**
 * GoogleCalendarProvider
 *
 * Adapter that implements ICalendarProvider for Google Calendar API.
 * Uses PKCE for the authorization code flow (recommended for all clients).
 * Fetches events read-only; write operations are explicitly out of scope for this phase.
 *
 * Token refresh strategy:
 * - If a 401 is received during an API call, the caller (CalendarSyncService) is
 *   responsible for calling refreshAccessToken() and retrying. The provider itself
 *   does not cache or refresh tokens transparently to keep it stateless.
 *
 * Sync strategy:
 * - First sync: full event list within the configured time window
 * - Subsequent syncs: incremental using nextSyncToken (Google's native support)
 * - If the sync token is invalid (410 Gone), we fall back to a full sync
 */
@Injectable()
export class GoogleCalendarProvider implements ICalendarProvider {
  readonly providerName = 'Google Calendar';
  private readonly logger = new Logger(GoogleCalendarProvider.name);

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  getAuthorizationUrl(state: string, codeChallenge: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: GOOGLE_SCOPES.join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent', // force consent to always get a refresh_token
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    redirectUri: string,
  ): Promise<TokenResponse> {
    const body = new URLSearchParams({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    });

    const data = await this.postForm<GoogleTokenResponse>(GOOGLE_TOKEN_URL, body);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresInSeconds: data.expires_in,
      scopes: data.scope.split(' '),
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'refresh_token',
    });

    const data = await this.postForm<GoogleTokenResponse>(GOOGLE_TOKEN_URL, body);

    return {
      accessToken: data.access_token,
      // Google does not return a new refresh token on refresh — keep the existing one
      refreshToken: null,
      expiresInSeconds: data.expires_in,
      scopes: data.scope ? data.scope.split(' ') : [],
    };
  }

  async fetchAccountInfo(accessToken: string): Promise<AccountInfo> {
    const data = await this.getJson<{ email?: string; name?: string }>(
      GOOGLE_USERINFO_URL,
      accessToken,
    );
    return {
      email: data.email ?? '',
      displayName: data.name ?? null,
    };
  }

  async fetchEvents(accessToken: string, options: FetchEventsOptions): Promise<ProviderEventPage> {
    const calendarId = 'primary';
    const maxResults = options.maxResults ?? 250;

    // Incremental sync: use syncCursor (nextSyncToken) if available
    if (options.syncCursor) {
      return this.fetchIncremental(accessToken, calendarId, options.syncCursor);
    }

    return this.fetchFull(accessToken, calendarId, options, maxResults);
  }

  private async fetchFull(
    accessToken: string,
    calendarId: string,
    options: FetchEventsOptions,
    maxResults: number,
  ): Promise<ProviderEventPage> {
    const params = new URLSearchParams({
      timeMin: options.timeMin.toISOString(),
      timeMax: options.timeMax.toISOString(),
      maxResults: String(maxResults),
      singleEvents: 'true',
      orderBy: 'startTime',
      showDeleted: 'false',
    });

    const url = `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;
    const data = await this.getJson<GoogleEventsListResponse>(url, accessToken);

    const events = (data.items ?? []).map((e) => this.normalizeEvent(e));
    return {
      events,
      nextSyncCursor: data.nextSyncToken ?? null,
    };
  }

  private async fetchIncremental(
    accessToken: string,
    calendarId: string,
    syncToken: string,
  ): Promise<ProviderEventPage> {
    const params = new URLSearchParams({
      syncToken,
      showDeleted: 'true',
    });

    const url = `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;

    try {
      const data = await this.getJson<GoogleEventsListResponse>(url, accessToken);
      const events = (data.items ?? []).map((e) => this.normalizeEvent(e));
      return { events, nextSyncCursor: data.nextSyncToken ?? null };
    } catch (err) {
      if (err instanceof ProviderTransientError && err.statusCode === 410) {
        // Sync token expired — caller must fall back to full sync
        this.logger.warn('Google sync token expired (410), full sync required');
        throw err;
      }
      throw err;
    }
  }

  private normalizeEvent(event: GoogleEvent): NormalizedCalendarEvent {
    const start = event.start;
    const end = event.end;
    const isAllDay = !start?.dateTime;

    const startAt = isAllDay
      ? new Date(start?.date + 'T00:00:00')
      : new Date(start?.dateTime ?? '');
    const endAt = isAllDay
      ? new Date(end?.date + 'T00:00:00')
      : new Date(end?.dateTime ?? '');

    const timezone = start?.timeZone ?? null;
    const isCancelled = event.status === 'cancelled';

    const meetingUrl = this.extractMeetingUrl(event);
    const attendees = this.normalizeAttendees(event.attendees ?? []);

    return {
      externalId: event.id ?? '',
      title: this.sanitizeText(event.summary ?? '(No title)', 255),
      description: event.description ? this.sanitizeText(event.description, 2000) : null,
      startAt,
      endAt,
      timezone,
      isAllDay,
      location: event.location ? this.sanitizeText(event.location, 500) : null,
      meetingUrl,
      organizer: event.organizer?.email ?? null,
      attendees,
      isCancelled,
      raw: event as Record<string, unknown>,
    };
  }

  private extractMeetingUrl(event: GoogleEvent): string | null {
    // Google Meet link via hangoutLink (legacy) or conferenceData
    if (event.hangoutLink) return event.hangoutLink;
    const entry = event.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video');
    if (entry?.uri) return entry.uri;
    // Also check location for zoom/teams URLs
    if (event.location && this.isVideoUrl(event.location)) return event.location;
    return null;
  }

  private normalizeAttendees(attendees: GoogleAttendee[]): NormalizedAttendee[] {
    return attendees
      .filter((a) => a.email)
      .map((a) => ({
        email: a.email!,
        name: a.displayName ?? null,
        status: a.responseStatus ?? 'none',
      }));
  }

  private isVideoUrl(url: string): boolean {
    return /zoom\.us|teams\.microsoft\.com|meet\.google\.com|webex\.com/i.test(url);
  }

  private sanitizeText(text: string, maxLength: number): string {
    return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, maxLength);
  }

  private async postForm<T>(url: string, body: URLSearchParams): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const json = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      this.handleErrorResponse(response.status, json);
    }

    return json as T;
  }

  private async getJson<T>(url: string, accessToken: string): Promise<T> {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const json = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      this.handleErrorResponse(response.status, json);
    }

    return json as T;
  }

  private handleErrorResponse(status: number, body: Record<string, unknown>): never {
    const errorCode = (body['error'] as string | undefined) ?? '';
    const message = (body['error_description'] as string | undefined) ?? JSON.stringify(body);

    this.logger.warn(`Google API error ${status}: ${errorCode} — ${message}`);

    if (status === 401 || errorCode === 'invalid_grant') {
      throw new ProviderTokenRevokedError(this.providerName, `Token revoked or expired: ${message}`);
    }
    if (status === 410) {
      throw new ProviderTransientError(this.providerName, 410, 'Sync token expired');
    }
    if (status === 429 || status >= 500) {
      throw new ProviderTransientError(this.providerName, status, `Transient error: ${message}`);
    }

    throw new Error(`Google Calendar API error ${status}: ${message}`);
  }

  /** Revokes a token — called during calendar disconnect */
  async revokeToken(token: string): Promise<void> {
    try {
      await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: 'POST' });
    } catch (err) {
      // Best-effort — we still mark the connection as disconnected locally
      this.logger.warn('Failed to revoke Google token (best-effort)', err);
    }
  }
}
