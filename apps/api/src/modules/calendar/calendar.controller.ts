import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Redirect,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CalendarProvider } from '@prisma/client';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CalendarConnectionService } from './services/calendar-connection.service';
import { CalendarSyncService } from './services/calendar-sync.service';
import { CalendarEventService } from './services/calendar-event.service';
import {
  CalendarConnectionResponseDto,
  CalendarEventResponseDto,
  ConnectCalendarResponseDto,
  FilterEventsQueryDto,
  InitiateCalendarConnectionDto,
  SyncStatusResponseDto,
  TriggerSyncResponseDto,
} from './dto/calendar.dto';

/**
 * CalendarController
 *
 * Exposes the calendar integration API surface.
 * All endpoints require authentication (covered by the global JwtAuthGuard).
 *
 * Endpoint summary:
 *
 * Connection management:
 *   GET    /calendar/connections              — list active connections
 *   POST   /calendar/google/connect          — initiate Google OAuth
 *   GET    /calendar/google/callback         — Google OAuth callback (redirected from provider)
 *   POST   /calendar/microsoft/connect       — initiate Microsoft OAuth
 *   GET    /calendar/microsoft/callback      — Microsoft OAuth callback
 *   DELETE /calendar/connections/:id         — disconnect a calendar
 *
 * Events:
 *   GET    /calendar/events                  — get all normalized events for the user
 *   GET    /calendar/connections/:id/events  — get events for a specific connection
 *
 * Sync:
 *   POST   /calendar/connections/:id/sync    — trigger manual sync
 *   GET    /calendar/status                  — sync status for all connections
 */
@ApiTags('Calendar')
@ApiBearerAuth()
@Controller('calendar')
export class CalendarController {
  private readonly logger = new Logger(CalendarController.name);

  constructor(
    private readonly connectionService: CalendarConnectionService,
    private readonly syncService: CalendarSyncService,
    private readonly eventService: CalendarEventService,
  ) {}

  // ─── Connection Management ─────────────────────────────────────────────────

  @Get('connections')
  @ApiOperation({ summary: 'List active calendar connections for the authenticated user' })
  @ApiResponse({ status: 200, type: [CalendarConnectionResponseDto] })
  listConnections(@CurrentUser('id') userId: string): Promise<CalendarConnectionResponseDto[]> {
    return this.connectionService.listConnections(userId) as Promise<CalendarConnectionResponseDto[]>;
  }

  @Post('google/connect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate Google Calendar OAuth connection' })
  @ApiResponse({ status: 200, type: ConnectCalendarResponseDto })
  connectGoogle(
    @CurrentUser('id') userId: string,
    @Body() dto: InitiateCalendarConnectionDto,
  ): Promise<ConnectCalendarResponseDto> {
    return this.connectionService.initiateConnection(
      userId,
      CalendarProvider.GOOGLE,
      dto.redirectUri,
    );
  }

  @Get('google/callback')
  @ApiOperation({
    summary: 'Google OAuth callback — handles redirect from Google after consent',
    description:
      'This endpoint is called by Google after the user grants consent. ' +
      'In a mobile app, the deep-link redirect is handled differently — this endpoint ' +
      'is primarily for server-side redirect handling.',
  })
  @ApiQuery({ name: 'code', required: true })
  @ApiQuery({ name: 'state', required: true })
  @ApiResponse({ status: 302, description: 'Redirects to app deep link on success' })
  async handleGoogleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
  ) {
    this.logger.log(`Google OAuth callback received (state=${state})`);
    const result = await this.connectionService.handleCallback(
      CalendarProvider.GOOGLE,
      code,
      state,
    );
    // In a production mobile flow, deep-link redirect would go here.
    // For server-side flows (admin panel), return JSON.
    return result;
  }

  @Post('microsoft/connect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate Microsoft Calendar OAuth connection' })
  @ApiResponse({ status: 200, type: ConnectCalendarResponseDto })
  connectMicrosoft(
    @CurrentUser('id') userId: string,
    @Body() dto: InitiateCalendarConnectionDto,
  ): Promise<ConnectCalendarResponseDto> {
    return this.connectionService.initiateConnection(
      userId,
      CalendarProvider.MICROSOFT,
      dto.redirectUri,
    );
  }

  @Get('microsoft/callback')
  @ApiOperation({
    summary: 'Microsoft OAuth callback — handles redirect from Microsoft after consent',
  })
  @ApiQuery({ name: 'code', required: true })
  @ApiQuery({ name: 'state', required: true })
  async handleMicrosoftCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
  ) {
    this.logger.log(`Microsoft OAuth callback received (state=${state})`);
    const result = await this.connectionService.handleCallback(
      CalendarProvider.MICROSOFT,
      code,
      state,
    );
    return result;
  }

  @Delete('connections/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disconnect a calendar provider' })
  @ApiParam({ name: 'id', description: 'Calendar connection ID' })
  @ApiResponse({ status: 204, description: 'Calendar disconnected successfully' })
  disconnect(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) connectionId: string,
  ): Promise<void> {
    return this.connectionService.disconnect(userId, connectionId);
  }

  // ─── Events ────────────────────────────────────────────────────────────────

  @Get('events')
  @ApiOperation({ summary: 'Get all normalized calendar events for the authenticated user' })
  @ApiResponse({ status: 200, type: [CalendarEventResponseDto] })
  getEvents(
    @CurrentUser('id') userId: string,
    @Query() query: FilterEventsQueryDto,
  ): Promise<CalendarEventResponseDto[]> {
    return this.eventService.getUpcomingEvents({
      userId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      provider: query.provider,
      limit: query.limit,
    }) as Promise<CalendarEventResponseDto[]>;
  }

  // ─── Sync ──────────────────────────────────────────────────────────────────

  @Post('connections/:id/sync')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger a manual sync for a specific calendar connection' })
  @ApiParam({ name: 'id', description: 'Calendar connection ID' })
  @ApiResponse({ status: 202, type: TriggerSyncResponseDto })
  async triggerSync(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) connectionId: string,
  ): Promise<TriggerSyncResponseDto> {
    // Verify the connection belongs to the current user
    const connections = await this.connectionService.listConnections(userId);
    const owned = connections.some((c) => c.id === connectionId);
    if (!owned) {
      throw new Error('Connection not found or not owned by this user');
    }

    // Trigger async — do not await to keep the endpoint non-blocking
    const { syncAttemptId } = await this.syncService.syncConnection(connectionId, 'user');
    return {
      message: `Sync started for connection ${connectionId}`,
      syncAttemptId,
    };
  }

  @Get('status')
  @ApiOperation({ summary: 'Get sync status for all calendar connections' })
  @ApiResponse({ status: 200, type: [SyncStatusResponseDto] })
  getSyncStatus(@CurrentUser('id') userId: string): Promise<SyncStatusResponseDto[]> {
    return this.eventService.getSyncStatus(userId) as Promise<SyncStatusResponseDto[]>;
  }
}
