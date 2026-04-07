import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CalendarProvider } from '@prisma/client';
import * as crypto from 'node:crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { EncryptionService } from '../../../common/encryption/encryption.service';
import { GoogleCalendarProvider } from '../providers/google/google-calendar.provider';
import { MicrosoftCalendarProvider } from '../providers/microsoft/microsoft-calendar.provider';
import { ICalendarProvider, TokenResponse } from '../interfaces/calendar-provider.interface';
import { Prisma } from '@prisma/client';

const OAUTH_STATE_TTL_MINUTES = 10;

/**
 * CalendarConnectionService
 *
 * Manages the lifecycle of calendar provider connections:
 * - Initiating the OAuth flow (generating authorization URLs with PKCE)
 * - Handling OAuth callbacks (code exchange, token storage)
 * - Listing and disconnecting connections
 * - Token refresh (called by sync service when access token is expired)
 *
 * Tokens are always stored encrypted. The decrypted form only exists in memory
 * for the duration of a single request or sync operation.
 *
 * Security:
 * - PKCE prevents authorization code interception attacks
 * - State token prevents CSRF
 * - State + PKCE verifier are stored server-side in OAuthState (TTL: 10 min)
 * - After use, OAuthState is marked as used (not deleted, for audit trail)
 */
@Injectable()
export class CalendarConnectionService {
  private readonly logger = new Logger(CalendarConnectionService.name);

  private readonly providers: Record<CalendarProvider, ICalendarProvider>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService,
    google: GoogleCalendarProvider,
    microsoft: MicrosoftCalendarProvider,
  ) {
    this.providers = {
      GOOGLE: google,
      MICROSOFT: microsoft,
    };
  }

  /**
   * Step 1 of OAuth: Generate an authorization URL for the user to visit.
   * Creates an OAuthState record with the PKCE verifier stored server-side.
   */
  async initiateConnection(userId: string, provider: CalendarProvider) {
    const redirectUri = this.getRedirectUri(provider);

    // Ensure no active connection already exists for this provider
    const existing = await this.prisma.calendarConnection.findUnique({
      where: { userId_provider: { userId, provider } },
    });
    if (existing?.isActive) {
      throw new ConflictException(
        `A ${provider} calendar is already connected. Disconnect it first.`,
      );
    }

    // Generate PKCE pair
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);

    // Generate state token
    const state = crypto.randomBytes(32).toString('hex');

    const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MINUTES * 60 * 1000);

    await this.prisma.oAuthState.create({
      data: { userId, provider, state, codeVerifier, redirectUri, expiresAt },
    });

    const authorizationUrl = this.providers[provider].getAuthorizationUrl(
      state,
      codeChallenge,
      redirectUri,
    );

    this.logger.log(`OAuth flow initiated for user ${userId} provider ${provider}`);

    return { authorizationUrl, state };
  }

  /**
   * Step 2 of OAuth: Handle the callback from the provider.
   * Validates state, exchanges code for tokens, fetches account info,
   * and persists the encrypted connection.
   */
  async handleCallback(provider: CalendarProvider, code: string, state: string) {
    const oauthState = await this.prisma.oAuthState.findUnique({ where: { state } });

    if (!oauthState) {
      throw new BadRequestException('Invalid OAuth state — possible CSRF attempt');
    }
    if (oauthState.usedAt) {
      throw new BadRequestException('OAuth state already used — replay attack prevented');
    }
    if (oauthState.expiresAt < new Date()) {
      throw new BadRequestException('OAuth state expired — restart the connection flow');
    }
    if (oauthState.provider !== provider) {
      throw new BadRequestException('OAuth state provider mismatch');
    }

    // Mark as used immediately to prevent replay
    await this.prisma.oAuthState.update({
      where: { id: oauthState.id },
      data: { usedAt: new Date() },
    });

    const providerAdapter = this.providers[provider];
    const tokenResponse = await providerAdapter.exchangeCodeForTokens(
      code,
      oauthState.codeVerifier,
      oauthState.redirectUri,
    );

    const accountInfo = await providerAdapter.fetchAccountInfo(tokenResponse.accessToken);

    const expiresAt = new Date(Date.now() + tokenResponse.expiresInSeconds * 1000);

    // Upsert connection (handles re-connection after disconnect)
    const connection = await this.prisma.calendarConnection.upsert({
      where: { userId_provider: { userId: oauthState.userId, provider } },
      create: {
        userId: oauthState.userId,
        provider,
        accessToken: this.encryption.encrypt(tokenResponse.accessToken),
        refreshToken: tokenResponse.refreshToken
          ? this.encryption.encrypt(tokenResponse.refreshToken)
          : '',
        expiresAt,
        email: accountInfo.email,
        calendarId: 'primary',
        tenantId: tokenResponse.tenantId ?? null,
        scopes: tokenResponse.scopes,
        isActive: true,
        disconnectedAt: null,
      },
      update: {
        accessToken: this.encryption.encrypt(tokenResponse.accessToken),
        refreshToken: tokenResponse.refreshToken
          ? this.encryption.encrypt(tokenResponse.refreshToken)
          : undefined,
        expiresAt,
        email: accountInfo.email,
        tenantId: tokenResponse.tenantId ?? null,
        scopes: tokenResponse.scopes,
        isActive: true,
        disconnectedAt: null,
        syncCursor: null, // reset cursor on reconnect to force full sync
      },
    });

    await this.writeAuditLog(oauthState.userId, 'CALENDAR_CONNECTED', {
      provider,
      connectionId: connection.id,
      email: accountInfo.email,
    });

    this.logger.log(
      `Calendar connected: user=${oauthState.userId} provider=${provider} email=${accountInfo.email}`,
    );

    return { connectionId: connection.id, provider, email: accountInfo.email };
  }

  /**
   * Lists all active calendar connections for a user (no tokens in response).
   */
  async listConnections(userId: string) {
    return this.prisma.calendarConnection.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        provider: true,
        email: true,
        isActive: true,
        syncedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Disconnects a calendar provider. Best-effort token revocation.
   */
  async disconnect(userId: string, connectionId: string) {
    const connection = await this.prisma.calendarConnection.findFirst({
      where: { id: connectionId, userId, isActive: true },
    });

    if (!connection) {
      throw new NotFoundException('Calendar connection not found');
    }

    // Best-effort: revoke the access token at the provider
    try {
      if (connection.provider === CalendarProvider.GOOGLE) {
        const decryptedAccess = this.encryption.decrypt(connection.accessToken);
        const google = this.providers.GOOGLE as GoogleCalendarProvider;
        await google.revokeToken(decryptedAccess);
      }
      // Microsoft: token revocation via logout endpoint is optional for delegated flows
    } catch (err) {
      this.logger.warn(`Token revocation failed for connection ${connectionId} (best-effort)`, err);
    }

    await this.prisma.calendarConnection.update({
      where: { id: connectionId },
      data: {
        isActive: false,
        disconnectedAt: new Date(),
        // Zero out tokens at rest after disconnect
        accessToken: '',
        refreshToken: '',
        syncCursor: null,
      },
    });

    await this.writeAuditLog(userId, 'CALENDAR_DISCONNECTED', {
      provider: connection.provider,
      connectionId,
    });

    this.logger.log(`Calendar disconnected: user=${userId} connection=${connectionId}`);
  }

  /**
   * Refreshes an expired access token. Called by CalendarSyncService.
   * Returns the new decrypted access token and updates the connection in DB.
   */
  async refreshToken(connection: {
    id: string;
    provider: CalendarProvider;
    refreshToken: string;
    userId: string;
  }): Promise<string> {
    const provider = this.providers[connection.provider];
    const decryptedRefresh = this.encryption.decrypt(connection.refreshToken);

    let tokenResponse: TokenResponse;
    try {
      tokenResponse = await provider.refreshAccessToken(decryptedRefresh);
    } catch (err) {
      await this.writeAuditLog(connection.userId, 'CALENDAR_TOKEN_REFRESH_FAILED', {
        provider: connection.provider,
        connectionId: connection.id,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    const expiresAt = new Date(Date.now() + tokenResponse.expiresInSeconds * 1000);

    await this.prisma.calendarConnection.update({
      where: { id: connection.id },
      data: {
        accessToken: this.encryption.encrypt(tokenResponse.accessToken),
        // Keep the existing refresh token if the provider did not return a new one
        ...(tokenResponse.refreshToken && {
          refreshToken: this.encryption.encrypt(tokenResponse.refreshToken),
        }),
        expiresAt,
      },
    });

    await this.writeAuditLog(connection.userId, 'CALENDAR_TOKEN_REFRESHED', {
      provider: connection.provider,
      connectionId: connection.id,
    });

    return tokenResponse.accessToken;
  }

  /**
   * Returns a valid (decrypted) access token for a connection.
   * Refreshes automatically if the token is expired or about to expire.
   */
  async getValidAccessToken(connectionId: string): Promise<{
    accessToken: string;
    connection: {
      id: string;
      provider: CalendarProvider;
      refreshToken: string;
      userId: string;
      syncCursor: string | null;
    };
  }> {
    const connection = await this.prisma.calendarConnection.findUnique({
      where: { id: connectionId },
      select: {
        id: true,
        provider: true,
        accessToken: true,
        refreshToken: true,
        expiresAt: true,
        userId: true,
        syncCursor: true,
        isActive: true,
      },
    });

    if (!connection || !connection.isActive) {
      throw new NotFoundException('Calendar connection not found or inactive');
    }

    const bufferMs = 5 * 60 * 1000; // 5-minute buffer before expiry
    const isExpired = connection.expiresAt.getTime() - Date.now() < bufferMs;

    let accessToken: string;

    if (isExpired) {
      accessToken = await this.refreshToken({
        id: connection.id,
        provider: connection.provider,
        refreshToken: connection.refreshToken,
        userId: connection.userId,
      });
    } else {
      accessToken = this.encryption.decrypt(connection.accessToken);
    }

    return {
      accessToken,
      connection: {
        id: connection.id,
        provider: connection.provider,
        refreshToken: connection.refreshToken,
        userId: connection.userId,
        syncCursor: connection.syncCursor,
      },
    };
  }

  // ─── PKCE Helpers ──────────────────────────────────────────────────────────

  private generateCodeVerifier(): string {
    // RFC 7636: 43-128 char URL-safe random string
    return crypto.randomBytes(48).toString('base64url');
  }

  private generateCodeChallenge(verifier: string): string {
    // S256: BASE64URL(SHA256(verifier))
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }

  // ─── Config Helpers ────────────────────────────────────────────────────────

  private getRedirectUri(provider: CalendarProvider): string {
    if (provider === CalendarProvider.GOOGLE) {
      return this.config.get<string>('google.redirectUri') ?? '';
    }
    return this.config.get<string>('microsoft.redirectUri') ?? '';
  }

  // ─── Audit ─────────────────────────────────────────────────────────────────

  private async writeAuditLog(
    actorId: string,
    action: string,
    metadata: Prisma.InputJsonValue,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: { actorId, action: action as never, metadata },
      });
    } catch (err) {
      this.logger.error('Failed to write audit log', err);
    }
  }
}
