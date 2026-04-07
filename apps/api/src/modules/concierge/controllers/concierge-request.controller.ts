import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ConciergeRequestService } from '../services/concierge-request.service';
import { RequestWorkflowService } from '../services/request-workflow.service';
import {
  AssignAgentDto,
  CreateConciergeRequestDto,
  CreateRequestFromRecommendationDto,
  UpdateRequestStatusDto,
} from '../dto/concierge.dto';

@ApiTags('Concierge Requests')
@ApiBearerAuth()
@Controller('concierge-requests')
export class ConciergeRequestController {
  constructor(
    private readonly requestService: ConciergeRequestService,
    private readonly workflowService: RequestWorkflowService,
  ) {}

  @Post()
  @Roles('EXECUTIVE')
  @ApiOperation({ summary: 'Create a concierge request from free text' })
  async createRequest(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateConciergeRequestDto,
  ) {
    return this.requestService.createRequest(user.id, dto);
  }

  @Post('from-recommendation')
  @Roles('EXECUTIVE')
  @ApiOperation({ summary: 'Create a concierge request from a recommendation' })
  async createFromRecommendation(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateRequestFromRecommendationDto,
  ) {
    return this.requestService.createFromRecommendation(user.id, dto);
  }

  @Get()
  @Roles('EXECUTIVE', 'CONCIERGE_AGENT', 'ADMIN')
  @ApiOperation({ summary: 'List concierge requests (role-scoped)' })
  async listRequests(@CurrentUser() user: { id: string; role: string }) {
    return this.requestService.listRequests(user.id, user.role);
  }

  @Get(':id')
  @Roles('EXECUTIVE', 'CONCIERGE_AGENT', 'ADMIN')
  @ApiOperation({ summary: 'Get concierge request detail with status history' })
  async getRequestDetail(
    @CurrentUser() user: { id: string; role: string },
    @Param('id') id: string,
  ) {
    return this.requestService.getRequestDetail(id, user.id, user.role);
  }

  @Patch(':id/status')
  @Roles('CONCIERGE_AGENT', 'ADMIN')
  @ApiOperation({ summary: 'Update request status' })
  async updateStatus(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateRequestStatusDto,
  ) {
    return this.workflowService.updateStatus(id, dto.status, dto.notes, user.id);
  }

  @Patch(':id/assign')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Assign an agent to a request' })
  async assignAgent(
    @Param('id') id: string,
    @Body() dto: AssignAgentDto,
  ) {
    return this.workflowService.assignAgent(id, dto.agentId);
  }
}
