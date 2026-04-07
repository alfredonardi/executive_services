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

// Microsoft identity platform endpoints (multi-tenant)
const MS_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const MS_GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

const MS_SCOPES = [
  'Calendars.Read',
  'User.Read',
  'offline_access', // required for refresh tokens
];

interface MicrosoftTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
  ext_expires_in?: number;
}

interface MicrosoftDateTimeTimeZone {
  dateTime: string;
  timeZone: string;
}

interface MicrosoftAttendee {
  emailAddress?: { address?: string; name?: string };
  status?: { response?: string };
  type?: string;
}

interface MicrosoftOnlineMeetingInfo {
  joinUrl?: string;
}

interface MicrosoftEvent {
  id?: string;
  subject?: string;
  bodyPreview?: string;
  start?: MicrosoftDateTimeTimeZone;
  end?: MicrosoftDateTimeTimeZone;
  location?: { displayName?: string };
  isAllDay?: boolean;
  isCancelled?: boolean;
  organizer?: { emailAddress?: { address?: string } };
  attendees?: MicrosoftAttendee[];
  onlineMeeting?: MicrosoftOnlineMeetingInfo;
  onlineMeetingUrl?: string;
  '@removed'?: { reason?: string };
}

interface MicrosoftCalendarViewResponse {
  value?: MicrosoftEvent[];
  '@odata.nextLink'?: string;
  '@odata.deltaLink'?: string;
}

interface MicrosoftUserResponse {
  mail?: string;
  userPrincipalName?: string;
  displayName?: string;
}

/**
 * MicrosoftCalendarProvider
 *
 * Adapter implementing ICalendarProvider for Microsoft 365 / Outlook Calendar
 * via Microsoft Graph API.
 *
 * Authorization flow: OAuth 2.0 Authorization Code + PKCE (multi-tenant)
 * Scopes: Calendars.Read, User.Read, offline_access
 *
 * Sync strategy:
 * - First sync: calendarView endpoint with time window
 * - Subsequent syncs: delta query (Graph API native incremental sync)
 * - If delta token is invalid, falls back to full calendarView sync
 *
 * Notes:
 * - Microsoft may not return a new refresh token on every refresh call.
 *   Keep the existing refresh token if the new one is absent.
 * - Enterprise tenants may require admin consent for certain scopes.
 *   We use delegated permissions only (no application-level access).
 */
@Injectable()
export class MicrosoftCalendarProvider implements ICalendarProvider {
  readonly providerName = 'Microsoft Calendar';
  private readonly logger = new Logger(MicrosoftCalendarProvider.name);

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  getAuthorizationUrl(state: string, codeChallenge: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: MS_SCOPES.join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      response_mode: 'query',
    });
    return `${MS_AUTH_URL}?${params.toString()}`;
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
      scope: MS_SCOPES.join(' '),
    });

    const data = await this.postForm<MicrosoftTokenResponse>(MS_TOKEN_URL, body);

    // Extract tenant ID from the ID token (JWT) if present
    const tenantId = data.id_token ? this.extractTenantFromIdToken(data.id_token) : undefined;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresInSeconds: data.expires_in,
      scopes: data.scope.split(' '),
      tenantId,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'refresh_token',
      scope: MS_SCOPES.join(' '),
    });

    const data = await this.postForm<MicrosoftTokenResponse>(MS_TOKEN_URL, body);

    return {
      accessToken: data.access_token,
      // Microsoft may not return a new refresh token; caller keeps the existing one if null
      refreshToken: data.refresh_token ?? null,
      expiresInSeconds: data.expires_in,
      scopes: data.scope ? data.scope.split(' ') : [],
    };
  }

  async fetchAccountInfo(accessToken: string): Promise<AccountInfo> {
    const data = await this.getJson<MicrosoftUserResponse>(`${MS_GRAPH_BASE}/me`, accessToken);
    return {
      email: data.mail ?? data.userPrincipalName ?? '',
      displayName: data.displayName ?? null,
    };
  }

  async fetchEvents(accessToken: string, options: FetchEventsOptions): Promise<ProviderEventPage> {
    // Use delta query for incremental sync if a cursor is available
    if (options.syncCursor) {
      return this.fetchDelta(accessToken, options.syncCursor);
    }
    return this.fetchCalendarView(accessToken, options);
  }

  private async fetchCalendarView(
    accessToken: string,
    options: FetchEventsOptions,
  ): Promise<ProviderEventPage> {
    const top = options.maxResults ?? 250;
    const params = new URLSearchParams({
      startDateTime: options.timeMin.toISOString(),
      endDateTime: options.timeMax.toISOString(),
      $top: String(top),
      $select: 'id,subject,bodyPreview,start,end,location,isAllDay,isCancelled,organizer,attendees,onlineMeeting,onlineMeetingUrl',
      $orderby: 'start/dateTime',
    });

    const url = `${MS_GRAPH_BASE}/me/calendarView?${params.toString()}`;
    const data = await this.getJson<MicrosoftCalendarViewResponse>(url, accessToken);

    // Initiate a delta query to get the delta link for subsequent incremental syncs
    const deltaUrl = `${MS_GRAPH_BASE}/me/calendarView/delta?${params.toString()}`;
    let nextSyncCursor: string | null = null;
    try {
      const deltaData = await this.getJson<MicrosoftCalendarViewResponse>(deltaUrl, accessToken);
      nextSyncCursor = deltaData['@odata.deltaLink'] ?? null;
    } catch {
      this.logger.warn('Failed to initialize delta query, next sync will be full');
    }

    const events = (data.value ?? []).map((e) => this.normalizeEvent(e));
    return { events, nextSyncCursor };
  }

  private async fetchDelta(accessToken: string, deltaLink: string): Promise<ProviderEventPage> {
    try {
      const data = await this.getJson<MicrosoftCalendarViewResponse>(deltaLink, accessToken);
      const events = (data.value ?? []).map((e) => this.normalizeEvent(e));
      return {
        events,
        nextSyncCursor: data['@odata.deltaLink'] ?? null,
      };
    } catch (err) {
      if (err instanceof ProviderTransientError && err.statusCode === 410) {
        this.logger.warn('Microsoft delta token expired (410), full sync required');
        throw err;
      }
      throw err;
    }
  }

  private normalizeEvent(event: MicrosoftEvent): NormalizedCalendarEvent {
    const isRemoved = !!event['@removed'];
    const isAllDay = event.isAllDay ?? false;

    const startAt = event.start?.dateTime
      ? new Date(event.start.dateTime)
      : new Date();
    const endAt = event.end?.dateTime
      ? new Date(event.end.dateTime)
      : new Date();

    const timezone = event.start?.timeZone ?? null;
    const meetingUrl = event.onlineMeeting?.joinUrl ?? event.onlineMeetingUrl ?? null;
    const attendees = this.normalizeAttendees(event.attendees ?? []);

    return {
      externalId: event.id ?? '',
      title: this.sanitizeText(event.subject ?? '(No title)', 255),
      description: event.bodyPreview ? this.sanitizeText(event.bodyPreview, 2000) : null,
      startAt,
      endAt,
      timezone,
      isAllDay,
      location: event.location?.displayName
        ? this.sanitizeText(event.location.displayName, 500)
        : null,
      meetingUrl,
      organizer: event.organizer?.emailAddress?.address ?? null,
      attendees,
      isCancelled: event.isCancelled ?? isRemoved,
      raw: event as Record<string, unknown>,
    };
  }

  private normalizeAttendees(attendees: MicrosoftAttendee[]): NormalizedAttendee[] {
    return attendees
      .filter((a) => a.emailAddress?.address)
      .map((a) => ({
        email: a.emailAddress!.address!,
        name: a.emailAddress?.name ?? null,
        status: this.mapAttendeeStatus(a.status?.response),
      }));
  }

  private mapAttendeeStatus(response: string | undefined): string {
    const map: Record<string, string> = {
      accepted: 'accepted',
      declined: 'declined',
      tentativelyAccepted: 'tentative',
      notResponded: 'needsAction',
      none: 'none',
      organizer: 'accepted',
    };
    return map[response ?? 'none'] ?? 'needsAction';
  }

  private sanitizeText(text: string, maxLength: number): string {
    return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, maxLength);
  }

  /** Extracts the tid (tenant ID) from an ID token JWT without signature verification */
  private extractTenantFromIdToken(idToken: string): string | undefined {
    try {
      const parts = idToken.split('.');
      if (parts.length !== 3) return undefined;
      const payloadPart = parts[1];
      if (!payloadPart) return undefined;
      const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf-8')) as {
        tid?: string;
      };
      return payload.tid;
    } catch {
      return undefined;
    }
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
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const json = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      this.handleErrorResponse(response.status, json);
    }

    return json as T;
  }

  private handleErrorResponse(status: number, body: Record<string, unknown>): never {
    const error = body['error'] as Record<string, unknown> | string | undefined;
    const errorCode =
      typeof error === 'object' ? String(error['code'] ?? '') : String(error ?? '');
    const message =
      typeof error === 'object'
        ? String(error['message'] ?? JSON.stringify(body))
        : String(body['error_description'] ?? JSON.stringify(body));

    this.logger.warn(`Microsoft Graph error ${status}: ${errorCode} — ${message}`);

    if (status === 401 || errorCode === 'InvalidAuthenticationToken') {
      throw new ProviderTokenRevokedError(this.providerName, `Token invalid: ${message}`);
    }
    if (errorCode === 'invalid_grant') {
      throw new ProviderTokenRevokedError(this.providerName, `Refresh token revoked: ${message}`);
    }
    if (status === 410) {
      throw new ProviderTransientError(this.providerName, 410, 'Delta token expired');
    }
    if (status === 429 || status >= 500) {
      throw new ProviderTransientError(this.providerName, status, `Transient error: ${message}`);
    }

    throw new Error(`Microsoft Graph API error ${status}: ${message}`);
  }
}
