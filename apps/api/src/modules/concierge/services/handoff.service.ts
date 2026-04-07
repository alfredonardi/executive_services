import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Conversation } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConversationService } from './conversation.service';
import { MessageService } from './message.service';
import { NotificationService } from './notification.service';

const HANDOFF_MESSAGE =
  'Your conversation has been transferred to a human concierge agent. ' +
  'Your full message history has been preserved and will be reviewed. ' +
  'An agent will respond to you shortly.';

@Injectable()
export class HandoffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
    private readonly notificationService: NotificationService,
  ) {}

  async initiateHandoff(
    conversationId: string,
    userId: string,
    reason?: string,
  ): Promise<Conversation> {
    const conversation = await this.conversationService.findById(conversationId);

    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    if (conversation.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // Update status to HUMAN_HANDOFF
    const updated = await this.conversationService.updateStatus(
      conversationId,
      'HUMAN_HANDOFF',
    );

    // Persist a system agent message so handoff is visible in history
    const content = reason
      ? `${HANDOFF_MESSAGE}\n\nReason noted: ${reason}`
      : HANDOFF_MESSAGE;

    await this.messageService.persistAgentMessage(conversationId, userId, content);

    // Notify the user
    await this.notificationService
      .notifyHandoffInitiated(userId, conversationId)
      .catch(() => undefined);

    return updated;
  }
}
