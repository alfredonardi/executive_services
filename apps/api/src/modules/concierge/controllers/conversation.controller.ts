import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AiAssistantService } from '../services/ai-assistant.service';
import { ConversationService } from '../services/conversation.service';
import { HandoffService } from '../services/handoff.service';
import { MessageService } from '../services/message.service';
import { AssignAgentDto, CreateConversationDto, HandoffDto, SendMessageDto } from '../dto/concierge.dto';

@ApiTags('Conversations')
@ApiBearerAuth()
@Controller('conversations')
export class ConversationController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
    private readonly aiAssistantService: AiAssistantService,
    private readonly handoffService: HandoffService,
  ) {}

  @Post()
  @Roles('EXECUTIVE')
  @ApiOperation({ summary: 'Create a new conversation' })
  async createConversation(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateConversationDto,
  ) {
    return this.conversationService.createConversation(user.id, dto.title);
  }

  @Get()
  @Roles('EXECUTIVE')
  @ApiOperation({ summary: 'List all conversations for the current user' })
  async listConversations(@CurrentUser() user: { id: string }) {
    return this.conversationService.listConversations(user.id);
  }

  @Get(':id')
  @Roles('EXECUTIVE')
  @ApiOperation({ summary: 'Get conversation detail with messages' })
  async getConversationDetail(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.conversationService.getConversationDetail(id, user.id);
  }

  @Post(':id/messages')
  @Roles('EXECUTIVE')
  @ApiOperation({ summary: 'Send a message and receive an AI reply' })
  async sendMessage(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    // Verify ownership
    await this.conversationService.getConversationDetail(id, user.id);

    const userMessage = await this.messageService.sendUserMessage(id, dto.content);

    const allMessages = await this.messageService.getMessages(id);
    const context = allMessages
      .slice(0, -1) // exclude the just-sent user message so we don't double it
      .map((m) => ({ role: m.role.toLowerCase(), content: m.content }));

    const { message: aiReply, shouldSuggestHandoff } =
      await this.aiAssistantService.generateReply(id, user.id, context, dto.content);

    return { userMessage, aiReply, shouldSuggestHandoff };
  }

  @Post(':id/handoff')
  @Roles('EXECUTIVE')
  @ApiOperation({ summary: 'Initiate handoff to a human concierge agent' })
  async initiateHandoff(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: HandoffDto,
  ) {
    return this.handoffService.initiateHandoff(id, user.id, dto.reason);
  }

  @Post(':id/assign')
  @Roles('CONCIERGE_AGENT', 'ADMIN')
  @ApiOperation({ summary: 'Assign an agent to a conversation' })
  async assignAgent(
    @Param('id') id: string,
    @Body() dto: AssignAgentDto,
  ) {
    return this.conversationService.assignAgent(id, dto.agentId);
  }
}
