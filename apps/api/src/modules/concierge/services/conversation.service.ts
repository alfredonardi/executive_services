import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Conversation, ConversationStatus, Message } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ConversationService {
  constructor(private readonly prisma: PrismaService) {}

  async createConversation(userId: string, title?: string): Promise<Conversation> {
    return this.prisma.conversation.create({
      data: { userId, title },
    });
  }

  async listConversations(userId: string): Promise<(Conversation & { _count: { messages: number } })[]> {
    return this.prisma.conversation.findMany({
      where: { userId },
      include: { _count: { select: { messages: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getConversationDetail(
    conversationId: string,
    userId: string,
  ): Promise<Conversation & { messages: Message[] }> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    if (conversation.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return conversation;
  }

  async findById(conversationId: string): Promise<Conversation | null> {
    return this.prisma.conversation.findUnique({ where: { id: conversationId } });
  }

  async updateStatus(conversationId: string, status: ConversationStatus): Promise<Conversation> {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status },
    });
  }

  async assignAgent(conversationId: string, agentId: string): Promise<Conversation> {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { assignedAgentId: agentId },
    });
  }
}
