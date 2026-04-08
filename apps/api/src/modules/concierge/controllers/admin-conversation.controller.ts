import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ConversationService } from '../services/conversation.service';
import { MessageService } from '../services/message.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { SendMessageDto } from '../dto/concierge.dto';

type ConversationStatus = 'ACTIVE' | 'HUMAN_HANDOFF' | 'RESOLVED' | 'ARCHIVED';

interface AuthUser {
  id: string;
  role: string;
}

@ApiTags('Admin — Conversations')
@ApiBearerAuth()
@Controller('admin/conversations')
export class AdminConversationController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * List conversations for agent/admin review.
   * Agents see only HUMAN_HANDOFF conversations or those assigned to them.
   * Admins see all.
   */
  @Get()
  @Roles('CONCIERGE_AGENT', 'ADMIN')
  @ApiOperation({ summary: 'List active/handoff conversations (agent/admin)' })
  @ApiQuery({ name: 'status', enum: ['ACTIVE', 'HUMAN_HANDOFF', 'RESOLVED', 'ARCHIVED'], required: false })
  async listConversations(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: ConversationStatus,
  ) {
    const isAdmin = user.role === 'ADMIN';

    const where = isAdmin
      ? {
          ...(status && { status }),
        }
      : {
          // Agents see: HUMAN_HANDOFF + conversations assigned to them
          OR: [
            { status: 'HUMAN_HANDOFF' as ConversationStatus },
            { assignedAgentId: user.id },
          ],
          ...(status && { status }),
        };

    return this.prisma.conversation.findMany({
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
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Get full conversation thread with messages.
   * Agents can only access HUMAN_HANDOFF conversations or their own assigned ones.
   */
  @Get(':id')
  @Roles('CONCIERGE_AGENT', 'ADMIN')
  @ApiOperation({ summary: 'Get conversation thread (agent/admin)' })
  async getConversation(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
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
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }

    this.assertAgentAccess(user, conversation);

    return conversation;
  }

  /**
   * Send an agent reply in a conversation thread.
   * Persists the message with role=AGENT and the agent's user ID.
   */
  @Post(':id/messages')
  @Roles('CONCIERGE_AGENT', 'ADMIN')
  @ApiOperation({ summary: 'Send agent reply in conversation thread' })
  async sendAgentMessage(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        assignedAgentId: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }

    this.assertAgentAccess(user, conversation);

    const message = await this.messageService.persistAgentMessage(id, user.id, dto.content);

    // Auto-assign agent if not yet assigned
    if (!conversation.assignedAgentId) {
      await this.conversationService.assignAgent(id, user.id);
    }

    return message;
  }

  private assertAgentAccess(
    user: AuthUser,
    conversation: { status: string; assignedAgentId: string | null },
  ): void {
    if (user.role === 'ADMIN') return;

    const isAssigned = conversation.assignedAgentId === user.id;
    const isHandoff = conversation.status === 'HUMAN_HANDOFF';

    if (!isAssigned && !isHandoff) {
      throw new ForbiddenException(
        'Agents may only access HUMAN_HANDOFF conversations or those assigned to them',
      );
    }
  }
}
