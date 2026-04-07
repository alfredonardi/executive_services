import { ProviderEventPage } from '../domain/calendar-event.model';

/**
 * ICalendarProvider
 *
 * Every external calendar integration must implement this interface.
 * The rest of the system (sync service, connection service) depends only on
 * this abstraction — never on Google- or Microsoft-specific code.
 *
 * Design principle: providers are stateless adapters. All state (tokens, cursors)
 * is passed in and returned — never stored inside the provider instance.
 */
export interface ICalendarProvider {
  /** Human-readable name for observability / logging */
  readonly providerName: string;

  /**
   * Generates an authorization URL to redirect the user to.
   * @param state  - opaque state token (stored in OAuthState table)
   * @param codeChallenge - PKCE code challenge derived from the verifier
   * @param redirectUri - the callback URL registered in the provider
   */
  getAuthorizationUrl(state: string, codeChallenge: string, redirectUri: string): string;

  /**
   * Exchanges an authorization code for access + refresh tokens.
   * @param code - the authorization code from the provider callback
   * @param codeVerifier - PKCE verifier (must match the challenge used in getAuthorizationUrl)
   * @param redirectUri - must match the one used in getAuthorizationUrl
   */
  exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    redirectUri: string,
  ): Promise<TokenResponse>;

  /**
   * Refreshes an access token using a refresh token.
   * Should throw a ProviderTokenExpiredError when the refresh token has been revoked.
   */
  refreshAccessToken(refreshToken: string): Promise<TokenResponse>;

  /**
   * Fetches upcoming calendar events for the authenticated user.
   * @param accessToken - a valid (not expired) access token
   * @param options - fetch options
   */
  fetchEvents(accessToken: string, options: FetchEventsOptions): Promise<ProviderEventPage>;

  /**
   * Fetches basic account information (email, display name) after OAuth.
   */
  fetchAccountInfo(accessToken: string): Promise<AccountInfo>;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string | null;
  expiresInSeconds: number;
  scopes: string[];
  /** Microsoft-specific: the tenant ID */
  tenantId?: string;
}

export interface FetchEventsOptions {
  /** Start of the time window to fetch events for */
  timeMin: Date;
  /** End of the time window */
  timeMax: Date;
  /** Opaque cursor from a previous sync (enables incremental sync) */
  syncCursor?: string | null;
  /** Maximum events to return per page */
  maxResults?: number;
}

export interface AccountInfo {
  email: string;
  displayName: string | null;
}

/**
 * Thrown when a provider's token has been revoked or is permanently invalid.
 * The connection should be marked as disconnected and the user notified.
 */
export class ProviderTokenRevokedError extends Error {
  constructor(
    public readonly provider: string,
    message = 'Provider token has been revoked',
  ) {
    super(message);
    this.name = 'ProviderTokenRevokedError';
  }
}

/**
 * Thrown when a provider API call fails with a transient error (rate limit, 5xx).
 * The sync should be retried with exponential backoff.
 */
export class ProviderTransientError extends Error {
  constructor(
    public readonly provider: string,
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderTransientError';
  }
}
