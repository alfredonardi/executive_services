import { Injectable } from '@nestjs/common';
import { Message, MessageRole } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class MessageService {
  constructor(private readonly prisma: PrismaService) {}

  async sendUserMessage(conversationId: string, content: string): Promise<Message> {
    return this.prisma.message.create({
      data: { conversationId, role: MessageRole.USER, content },
    });
  }

  async persistAiMessage(
    conversationId: string,
    content: string,
    tokensUsed?: number,
  ): Promise<Message> {
    return this.prisma.message.create({
      data: { conversationId, role: MessageRole.AI, content, tokensUsed },
    });
  }

  async persistAgentMessage(
    conversationId: string,
    agentId: string,
    content: string,
  ): Promise<Message> {
    return this.prisma.message.create({
      data: { conversationId, role: MessageRole.AGENT, content, agentId },
    });
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
