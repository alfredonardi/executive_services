import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConciergeRequestService } from '../services/concierge-request.service';
import { RequestWorkflowService } from '../services/request-workflow.service';
import { AssignAgentDto, UpdateRequestStatusDto } from '../dto/concierge.dto';

type RequestStatus = 'PENDING' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

/** Statuses that constitute an "open" queue visible to agents. */
const OPEN_STATUSES: RequestStatus[] = ['PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS'];

interface AuthUser {
  id: string;
  role: string;
}

@ApiTags('Admin — Requests')
@ApiBearerAuth()
@Controller('admin/requests')
export class AdminRequestController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestService: ConciergeRequestService,
    private readonly workflowService: RequestWorkflowService,
  ) {}

  /**
   * List requests for agent/admin review.
   * - ADMIN: all requests (optionally filtered by status)
   * - CONCIERGE_AGENT: all open-queue requests (PENDING/ACKNOWLEDGED/IN_PROGRESS)
   *   plus any completed/cancelled ones assigned to them
   */
  @Get()
  @Roles('CONCIERGE_AGENT', 'ADMIN')
  @ApiOperation({ summary: 'List requests for agent/admin queue' })
  @ApiQuery({ name: 'status', enum: ['PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], required: false })
  async listRequests(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: RequestStatus,
  ) {
    const isAdmin = user.role === 'ADMIN';

    const where = isAdmin
      ? { ...(status && { status }) }
      : {
          OR: [
            // All open requests visible to any agent
            { status: { in: OPEN_STATUSES } },
            // Closed requests if agent was assigned to them
            { assignedAgentId: user.id },
          ],
          ...(status && { status }),
        };

    return this.prisma.conciergeRequest.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            company: true,
            nationality: true,
          },
        },
        assignedAgent: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: { select: { statusUpdates: true } },
      },
      orderBy: [
        // Urgent first, then by createdAt descending
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  /**
   * Get full request detail with status history.
   * Agents can access any open-queue request plus assigned requests.
   */
  @Get(':id')
  @Roles('CONCIERGE_AGENT', 'ADMIN')
  @ApiOperation({ summary: 'Get request detail with full status history' })
  async getRequest(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    const request = await this.prisma.conciergeRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            company: true,
            title: true,
            nationality: true,
            timezone: true,
          },
        },
        assignedAgent: {
          select: { id: true, firstName: true, lastName: true },
        },
        statusUpdates: { orderBy: { createdAt: 'asc' } },
        conversation: {
          select: { id: true, status: true, title: true },
        },
      },
    });

    if (!request) {
      throw new NotFoundException(`Request ${id} not found`);
    }

    this.assertAgentAccess(user, request);

    return request;
  }

  /**
   * Update request status.
   * - ADMIN: can update any request
   * - CONCIERGE_AGENT: can update if they are assigned, or if request is in the open queue
   */
  @Patch(':id/status')
  @Roles('CONCIERGE_AGENT', 'ADMIN')
  @ApiOperation({ summary: 'Update request status (agent/admin)' })
  async updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateRequestStatusDto,
  ) {
    const request = await this.prisma.conciergeRequest.findUnique({
      where: { id },
      select: { id: true, status: true, assignedAgentId: true },
    });

    if (!request) {
      throw new NotFoundException(`Request ${id} not found`);
    }

    this.assertAgentAccess(user, request);

    return this.workflowService.updateStatus(id, dto.status, dto.notes, user.id);
  }

  /**
   * Assign (or self-assign) an agent to a request.
   * - ADMIN: can assign any agent
   * - CONCIERGE_AGENT: can only assign themselves (self-assign)
   */
  @Post(':id/assign')
  @Roles('CONCIERGE_AGENT', 'ADMIN')
  @ApiOperation({ summary: 'Assign agent to request (admins can assign anyone; agents self-assign)' })
  async assignAgent(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AssignAgentDto,
  ) {
    const request = await this.prisma.conciergeRequest.findUnique({
      where: { id },
      select: { id: true, status: true, assignedAgentId: true },
    });

    if (!request) {
      throw new NotFoundException(`Request ${id} not found`);
    }

    // Agents may only self-assign
    if (user.role === 'CONCIERGE_AGENT' && dto.agentId !== user.id) {
      throw new ForbiddenException('Agents may only assign themselves to requests');
    }

    return this.workflowService.assignAgent(id, dto.agentId);
  }

  private assertAgentAccess(
    user: AuthUser,
    request: { status: string; assignedAgentId: string | null },
  ): void {
    if (user.role === 'ADMIN') return;

    const isAssigned = request.assignedAgentId === user.id;
    const isOpenQueue = OPEN_STATUSES.includes(request.status as RequestStatus);

    if (!isAssigned && !isOpenQueue) {
      throw new ForbiddenException(
        'Agents may only access open-queue requests or those assigned to them',
      );
    }
  }
}
